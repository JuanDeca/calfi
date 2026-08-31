/**
 * Pruebas del auditor de integridad — SIEMPRE contra copias descartables en el
 * scratchpad, nunca contra data/calfi.db. Cada caso copia la base real, la
 * corrompe de una forma puntual y espera que `audit-integrity.ts` la detecte.
 *
 * Uso: npx tsx scripts/audit-integrity.test.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const REPO_ROOT = path.join(__dirname, "..");
const SOURCE_DB = path.join(REPO_ROOT, "data", "calfi.db");
const AUDIT_SCRIPT = path.join(__dirname, "audit-integrity.ts");
const SCRATCH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "calfi-audit-test-"));

let passed = 0;
let failed = 0;

function freshCopy(label: string): string {
  const dest = path.join(SCRATCH_DIR, `${label}.db`);
  fs.copyFileSync(SOURCE_DB, dest);
  for (const ext of ["-wal", "-shm"]) {
    const sidecar = `${SOURCE_DB}${ext}`;
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${dest}${ext}`);
  }
  return dest;
}

// La app real nunca activa PRAGMA foreign_keys — se replica acá para que las
// corrupciones de prueba (referencias colgantes a propósito) no choquen contra
// una constraint que en producción tampoco existe.
function openForCorruption(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = OFF");
  return db;
}

function runAudit(dbPath: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", AUDIT_SCRIPT, "--db", dbPath], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; status?: number };
    return { stdout: execError.stdout ?? "", exitCode: execError.status ?? 1 };
  }
}

function expectFinding(
  testName: string,
  dbPath: string,
  expectedSeverity: string,
  expectedSubstring: string
): void {
  const { stdout } = runAudit(dbPath);
  const found = stdout
    .split("\n")
    .some((line) => line.includes(`[${expectedSeverity}]`) && line.includes(expectedSubstring));
  if (found) {
    console.log(`PASS ${testName}`);
    passed += 1;
  } else {
    console.log(`FAIL ${testName}`);
    console.log(`  esperaba una línea con [${expectedSeverity}] y "${expectedSubstring}"`);
    console.log(`  salida completa:\n${stdout}`);
    failed += 1;
  }
}

// ---------------------------------------------------------------------------
// 1. Cadena de saldos
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("balance-chain");
  const db = openForCorruption(dbPath);
  const row = db
    .prepare(`SELECT id FROM transactions WHERE running_balance IS NOT NULL ORDER BY date, id LIMIT 1 OFFSET 5`)
    .get() as { id: number };
  db.prepare(`UPDATE transactions SET running_balance = running_balance + 999999 WHERE id = ?`).run(row.id);
  db.close();
  expectFinding("Cadena de saldos rota", dbPath, "ERROR", "saldo esperado");
}

// ---------------------------------------------------------------------------
// 2. Descripción rota
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("broken-description");
  const db = openForCorruption(dbPath);
  const row = db.prepare(`SELECT id FROM transactions LIMIT 1`).get() as { id: number };
  db.prepare(`UPDATE transactions SET description = 'de servicio Test' WHERE id = ?`).run(row.id);
  db.close();
  expectFinding("Descripción con firma de parseo roto", dbPath, "ERROR", "perdido la primera palabra");
}

// ---------------------------------------------------------------------------
// 3. Regla huérfana por truncamiento
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("truncated-rule");
  const db = openForCorruption(dbPath);
  const rule = db.prepare(`SELECT counterparty_key, category_id FROM categorization_rules LIMIT 1`).get() as {
    counterparty_key: string;
    category_id: number | null;
  };
  const truncated = rule.counterparty_key.split(" ").slice(1).join(" ") || `x${rule.counterparty_key}`;
  db.prepare(
    `INSERT INTO categorization_rules (counterparty_key, category_id, expense_class, impacts_analysis) VALUES (?, ?, 'Variable', 'Sí')`
  ).run(truncated, rule.category_id);
  db.close();
  expectFinding("Regla huérfana por truncamiento", dbPath, "WARNING", "probable regla huérfana");
}

// ---------------------------------------------------------------------------
// 4. Referencia colgante
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("orphan-fk");
  const db = openForCorruption(dbPath);
  const row = db.prepare(`SELECT id FROM transactions LIMIT 1`).get() as { id: number };
  db.prepare(`UPDATE transactions SET category_id = 999999 WHERE id = ?`).run(row.id);
  db.close();
  expectFinding("Referencia colgante", dbPath, "ERROR", "category_id sin categoría");
}

// ---------------------------------------------------------------------------
// 5. Invariante analysis_amount
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("analysis-amount");
  const db = openForCorruption(dbPath);
  const row = db
    .prepare(`SELECT id, amount FROM transactions WHERE impacts_analysis = 'Sí' AND impact_type != 'Devolución de gasto' LIMIT 1`)
    .get() as { id: number; amount: number };
  db.prepare(`UPDATE transactions SET analysis_amount = ? WHERE id = ?`).run(Math.abs(row.amount) + 12345, row.id);
  db.close();
  expectFinding("Invariante analysis_amount", dbPath, "ERROR", `id=${row.id}`);
}

// ---------------------------------------------------------------------------
// 6. Desglose que no cierra
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("split-integrity");
  const db = openForCorruption(dbPath);
  const child = db
    .prepare(
      `SELECT id FROM transactions WHERE parent_transaction_id IS NOT NULL
       AND rule_reason NOT LIKE 'Corrección usuario%' AND rule_reason NOT LIKE 'Indicación usuario%' LIMIT 1`
    )
    .get() as { id: number };
  db.prepare(`UPDATE transactions SET amount = amount + 5000 WHERE id = ?`).run(child.id);
  db.close();
  expectFinding("Desglose que no cierra", dbPath, "ERROR", "hijos suman");
}

// ---------------------------------------------------------------------------
// 7. Reintegro sospechoso
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("reimbursement");
  const db = openForCorruption(dbPath);
  const row = db.prepare(`SELECT id FROM transactions WHERE reimbursement_expected IS NOT NULL LIMIT 1`).get() as
    | { id: number }
    | undefined;
  if (row) {
    db.prepare(`UPDATE transactions SET reimbursement_expected = 1 WHERE id = ?`).run(row.id);
    db.close();
    expectFinding("Reintegro sospechoso", dbPath, "WARNING", `id=${row.id}`);
  } else {
    db.close();
    console.log("SKIP Reintegro sospechoso (no hay ninguno cargado para probar)");
  }
}

// ---------------------------------------------------------------------------
// 8. mp_raw_id con formato raro
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("mp-raw-id");
  const db = openForCorruption(dbPath);
  const row = db.prepare(`SELECT id FROM transactions WHERE mp_raw_id IS NOT NULL LIMIT 1`).get() as { id: number };
  db.prepare(`UPDATE transactions SET mp_raw_id = 'xyz123' WHERE id = ?`).run(row.id);
  db.close();
  expectFinding("mp_raw_id con formato raro", dbPath, "WARNING", "xyz123");
}

// ---------------------------------------------------------------------------
// 9. Patrimonio desincronizado
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("patrimonio-sync");
  const db = openForCorruption(dbPath);
  const asset = db.prepare(`SELECT id, current_value FROM assets LIMIT 1`).get() as { id: number; current_value: number };
  db.prepare(`UPDATE assets SET current_value = ? WHERE id = ?`).run(asset.current_value + 777, asset.id);
  db.close();
  expectFinding("Patrimonio desincronizado con su historial", dbPath, "ERROR", "edición directa a la DB");
}

// ---------------------------------------------------------------------------
// 10. Backup desactualizado
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("backup-sync");
  const db = openForCorruption(dbPath);
  db.prepare(
    `INSERT INTO transactions (date, description, amount, impacts_analysis, expense_class, mp_raw_id)
     VALUES (date('now'), 'Fila de prueba del test suite', 1, 'No', 'No aplica', 'test-audit-backup-check')`
  ).run();
  db.close();
  expectFinding("Backup desactualizado", dbPath, "WARNING", "transactions:");
}

// ---------------------------------------------------------------------------
// 11. Sueldo desalineado
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("salary-drift");
  const db = openForCorruption(dbPath);
  db.prepare(`UPDATE recurring_movements SET default_amount = default_amount + 500000 WHERE description = 'Salario'`).run();
  db.close();
  expectFinding("Sueldo real vs. plantilla", dbPath, "WARNING", "aumento sin actualizar la plantilla");
}

// ---------------------------------------------------------------------------
// 12. Hueco en movimiento fijo
//
// Ninguna plantilla real hoy tiene más de un período ya generado en el
// pasado (la mayoría se cargó este mes), así que corromper una fila real no
// alcanza para ejercitar el chequeo — se inserta una plantilla sintética con
// `created_at` de hace 3 meses y CERO transacciones generadas, garantizando
// varios períodos pasados sin cubrir.
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("recurring-gap");
  const db = openForCorruption(dbPath);
  const category = db.prepare(`SELECT id FROM categories LIMIT 1`).get() as { id: number };
  db.prepare(
    `INSERT INTO recurring_movements
       (description, default_amount, category_id, expense_class, impacts_analysis, frequency, day_of_month, active, created_at)
     VALUES ('Prueba de hueco', 1000, ?, 'Fijo', 'Sí', 'mensual', 1, 1, datetime('now', '-3 months'))`
  ).run(category.id);
  db.close();
  expectFinding("Hueco en movimiento fijo", dbPath, "WARNING", "no hay transacción para");
}

// ---------------------------------------------------------------------------
// 13. Porcentaje de Reparto de sueldo fuera de rango
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("bucket-percentage");
  const db = openForCorruption(dbPath);
  db.prepare(`UPDATE salary_allocation_buckets SET percentage = 60 WHERE key = 'mejoras'`).run();
  db.close();
  expectFinding("Porcentaje de sobre fuera de rango", dbPath, "WARNING", "inusualmente alto");
}

// ---------------------------------------------------------------------------
// 14. Pockets desactualizados — Deudas ya tiene una confirmación real (2026-08-01),
// así que hay que borrarla en la copia para volver a exercitar el escenario
// "sin confirmar" (si no, el chequeo la saltea a propósito — ver más abajo).
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("stale-pocket");
  const db = openForCorruption(dbPath);
  db.prepare(`DELETE FROM salary_allocation_confirmations WHERE bucket_key = 'deudas'`).run();
  db.close();
  expectFinding(
    "Pockets de Reparto de sueldo desactualizados",
    dbPath,
    "NEEDS_CONFIRMATION",
    "Deudas (multas, impuesto inmobiliario, patente)"
  );
}

// ---------------------------------------------------------------------------
// 14b. Confirmación vencida — sintético: una confirmación de hace 100 días
// debería pedir que se vuelva a confirmar, sin importar si el pocket en sí
// tuvo actividad reciente o no.
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("expired-confirmation");
  const db = openForCorruption(dbPath);
  db.prepare(
    `INSERT INTO salary_allocation_confirmations (bucket_key, confirmed_balance, daily_rate, confirmed_at)
     VALUES ('mejoras', 90000, 0.0005, datetime('now', '-100 days'))`
  ).run();
  db.close();
  expectFinding("Confirmación vencida", dbPath, "NEEDS_CONFIRMATION", "hace más de 90 días");
}

// ---------------------------------------------------------------------------
// 15. Pendientes que envejecen — sintético, ya no hay ninguna real desde que
// se resolvieron las 31 viejas a "Desconocidos" (ver tareas.md 2026-07-31).
// ---------------------------------------------------------------------------
{
  const dbPath = freshCopy("aging-pendientes");
  const db = openForCorruption(dbPath);
  const category = db.prepare(`SELECT id FROM categories LIMIT 1`).get() as { id: number };
  db.prepare(
    `INSERT INTO transactions (date, description, amount, category_id, impacts_analysis, expense_class, mp_raw_id)
     VALUES (date('now', '-45 days'), 'Prueba de pendiente vieja', -100, ?, 'Pendiente', 'Variable', 'test-aging-pendiente')`
  ).run(category.id);
  db.close();
  expectFinding("Pendientes que envejecen", dbPath, "WARNING", "con más de 30 días");
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} prueba(s) OK, ${failed} fallida(s).`);
fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
if (failed > 0) process.exit(1);
