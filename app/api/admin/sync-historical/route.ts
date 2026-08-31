import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { getOrCreateCategoryId } from "@/lib/categorization";

const execFileAsync = promisify(execFile);

const PYTHON_BIN = path.join(process.cwd(), "scripts", "venv", "bin", "python3");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "migrate_historical.py");
const SOURCE_XLSX = process.env.CALFI_SYNC_HISTORICAL_XLSX ?? "";
const SOURCE_FILE_LABEL = SOURCE_XLSX ? path.basename(SOURCE_XLSX) : "(no configurado)";

// Marcas que dejan las acciones del usuario dentro de la app — si una
// transacción ya migrada tiene una de estas, no se pisa con la corrección
// del Excel externo, porque la decisión más reciente y más informada es la
// que tomó Juan directamente en Calfi.
const PROTECTED_RULE_REASONS = new Set(["Categorización manual", "Regla aprendida"]);

interface HistoricalRow {
  date: string;
  description: string;
  mpReference: string | null;
  amount: number;
  runningBalance: number | null;
  category: string | null;
  subcategory: string | null;
  ruleReason: string | null;
  impactsAnalysis: "Sí" | "No" | "Pendiente";
  impactType: string | null;
  impactReason: string | null;
  analysisAmount: number | null;
  expenseClass: "Fijo" | "Variable" | "Extraordinario" | "No aplica";
}

function dedupeReferences(rows: HistoricalRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = row.mpReference ?? "";
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 || !key ? key : `${key}-dup${count}`;
  });
}

export async function POST() {
  if (!SOURCE_XLSX) {
    return NextResponse.json(
      { error: "Falta configurar CALFI_SYNC_HISTORICAL_XLSX en el entorno." },
      { status: 400 }
    );
  }

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(PYTHON_BIN, [SCRIPT_PATH, SOURCE_XLSX]));
  } catch (execError) {
    stdout = (execError as { stdout?: string }).stdout ?? "";
    if (!stdout) {
      const message = execError instanceof Error ? execError.message : "Error inesperado.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const parsed = JSON.parse(stdout) as HistoricalRow[] | { error: string };
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 500 });
  }

  const mpRawIds = dedupeReferences(parsed);

  const result = mutate((connection) => {
    const findExisting = connection.prepare(
      "SELECT id, rule_reason FROM transactions WHERE mp_raw_id = ?"
    );
    const insert = connection.prepare(`
      INSERT INTO transactions (
        date, description, mp_reference, amount, running_balance,
        category_id, subcategory, rule_reason,
        impacts_analysis, impact_type, impact_reason, analysis_amount,
        expense_class, source_file, mp_raw_id
      ) VALUES (
        @date, @description, @mpReference, @amount, @runningBalance,
        @categoryId, @subcategory, @ruleReason,
        @impactsAnalysis, @impactType, @impactReason, @analysisAmount,
        @expenseClass, @sourceFile, @mpRawId
      )
    `);
    const update = connection.prepare(`
      UPDATE transactions SET
        category_id = @categoryId, subcategory = @subcategory,
        rule_reason = @ruleReason, impacts_analysis = @impactsAnalysis, impact_type = @impactType,
        impact_reason = @impactReason, analysis_amount = @analysisAmount, expense_class = @expenseClass
      WHERE id = @id
    `);

    let inserted = 0;
    let updated = 0;
    let skippedProtected = 0;

    const idByReference = new Map<string, number>();
    // Precargar los ids ya existentes para poder resolver el link padre-hijo
    // de desgloses aunque el padre y el hijo no se toquen en esta corrida.
    for (const row of connection
      .prepare("SELECT id, mp_raw_id FROM transactions WHERE mp_raw_id IS NOT NULL")
      .all() as { id: number; mp_raw_id: string }[]) {
      idByReference.set(row.mp_raw_id, row.id);
    }

    const syncAll = connection.transaction(() => {
      parsed.forEach((row, index) => {
        const mpRawId = mpRawIds[index];
        const existing = mpRawId
          ? (findExisting.get(mpRawId) as { id: number; rule_reason: string | null } | undefined)
          : undefined;

        if (existing && existing.rule_reason && PROTECTED_RULE_REASONS.has(existing.rule_reason)) {
          skippedProtected += 1;
          return;
        }

        const categoryId = row.category
          ? getOrCreateCategoryId(
              connection,
              row.category,
              row.category === "Ingresos" ? "ingreso" : "gasto"
            )
          : null;

        const fields = {
          categoryId,
          subcategory: row.subcategory,
          ruleReason: row.ruleReason,
          impactsAnalysis: row.impactsAnalysis,
          impactType: row.impactType,
          impactReason: row.impactReason,
          analysisAmount: row.analysisAmount,
          expenseClass: row.expenseClass,
        };

        if (existing) {
          update.run({ ...fields, id: existing.id });
          updated += 1;
        } else {
          const info = insert.run({
            date: row.date,
            description: row.description,
            mpReference: row.mpReference,
            amount: row.amount,
            runningBalance: row.runningBalance,
            sourceFile: SOURCE_FILE_LABEL,
            mpRawId: mpRawId || null,
            ...fields,
          });
          inserted += 1;
          if (mpRawId) idByReference.set(mpRawId, Number(info.lastInsertRowid));
        }
      });
    });
    syncAll();

    const linkParent = connection.prepare(
      "UPDATE transactions SET parent_transaction_id = ? WHERE id = ? AND parent_transaction_id IS NULL"
    );
    let linked = 0;
    for (const [mpRawId, id] of idByReference) {
      if (!mpRawId.includes("-")) continue;
      const prefix = mpRawId.split("-")[0];
      const parentId = idByReference.get(prefix);
      if (parentId && parentId !== id) {
        const info = linkParent.run(parentId, id);
        if (info.changes > 0) linked += 1;
      }
    }

    return { inserted, updated, skippedProtected, linked, total: parsed.length };
  });

  return NextResponse.json(result);
}
