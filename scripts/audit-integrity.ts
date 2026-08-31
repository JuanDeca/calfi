/**
 * Auditoría de integridad financiera de Calfi — de solo lectura, nunca escribe nada.
 *
 * Corre una lista de chequeos independientes contra la base (o una copia, vía --db)
 * y reporta hallazgos agrupados por severidad. Pensado para correrse periódicamente
 * (ver skill "auditoria-calfi") o cuando se sospeche algo raro.
 *
 * Uso: npx tsx scripts/audit-integrity.ts [--db <path>]
 */
import path from "node:path";
import Database from "better-sqlite3";

type Severity = "ERROR" | "WARNING" | "NEEDS_CONFIRMATION";

interface Finding {
  severity: Severity;
  message: string;
}

interface Check {
  name: string;
  run: (db: Database.Database) => Finding[];
}

const REPO_ROOT = path.join(__dirname, "..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, "data", "calfi.db");
const BACKUP_DB_PATH = path.join(
  process.env.CALFI_BACKUP_DIR ?? path.join(REPO_ROOT, "backups"),
  "calfi.db"
);

// Umbrales — ajustables, son un primer borrador sin calibrar contra uso real todavía.
const PENDIENTE_AGE_DAYS = 30;
const POCKET_STALE_DAYS = 45;
const ACCOUNT_STALE_DAYS = 60;
const BUCKET_PERCENTAGE_WARN_THRESHOLD = 50;
const BALANCE_CHAIN_TOLERANCE = 0.02;
const REIMBURSEMENT_OVER_FACTOR = 1.5;
const REIMBURSEMENT_STALE_DAYS = 60;

function daysSince(dateStr: string, now: Date): number {
  const then = new Date(dateStr.replace(" ", "T"));
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Chequeo 1: cadena de saldos rota
// ---------------------------------------------------------------------------
function checkBalanceChain(db: Database.Database): Finding[] {
  const rows = db
    .prepare(
      `SELECT id, date, description, amount, running_balance FROM transactions
       WHERE running_balance IS NOT NULL ORDER BY date, id`
    )
    .all() as { id: number; date: string; description: string; amount: number; running_balance: number }[];

  const findings: Finding[] = [];
  let prevBalance: number | null = null;
  for (const row of rows) {
    if (prevBalance !== null) {
      const expected = Math.round((prevBalance + row.amount) * 100) / 100;
      const actual = Math.round(row.running_balance * 100) / 100;
      if (Math.abs(expected - actual) > BALANCE_CHAIN_TOLERANCE) {
        findings.push({
          severity: "ERROR",
          message: `id=${row.id} (${row.date}, "${row.description}"): saldo esperado ${expected} pero el resumen dice ${actual}.`,
        });
      }
    }
    prevBalance = row.running_balance;
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 2: descripciones con la firma exacta del bug de parseo de PDF (julio 2026)
// ---------------------------------------------------------------------------
const BROKEN_DESCRIPTION_RE = /^(de|con|enviada|recibida|retirado|reservado)\s/;

function checkBrokenDescriptions(db: Database.Database): Finding[] {
  const rows = db.prepare(`SELECT id, date, description FROM transactions`).all() as {
    id: number;
    date: string;
    description: string;
  }[];

  return rows
    .filter((row) => row.description.trim() === "" || BROKEN_DESCRIPTION_RE.test(row.description))
    .map((row) => ({
      severity: "ERROR" as const,
      message: `id=${row.id} (${row.date}): descripción "${row.description || "(vacía)"}" tiene pinta de haber perdido la primera palabra al parsear.`,
    }));
}

// ---------------------------------------------------------------------------
// Chequeo 3: reglas de categorización huérfanas por truncamiento
// ---------------------------------------------------------------------------
function checkTruncatedRules(db: Database.Database): Finding[] {
  const rules = db
    .prepare(`SELECT counterparty_key, category_id FROM categorization_rules`)
    .all() as { counterparty_key: string; category_id: number | null }[];

  const findings: Finding[] = [];
  for (const short of rules) {
    for (const long of rules) {
      if (short === long) continue;
      if (
        long.counterparty_key.length > short.counterparty_key.length &&
        long.counterparty_key.endsWith(short.counterparty_key) &&
        long.category_id === short.category_id
      ) {
        findings.push({
          severity: "WARNING",
          message: `"${short.counterparty_key}" parece un recorte de "${long.counterparty_key}" (misma categoría) — probable regla huérfana de una descripción mal parseada.`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 4: referencias colgantes (SQLite no fuerza las FK en esta app)
// ---------------------------------------------------------------------------
function checkOrphanedReferences(db: Database.Database): Finding[] {
  const orphanQueries: { label: string; sql: string }[] = [
    {
      label: "transactions.category_id sin categoría",
      sql: `SELECT t.id FROM transactions t WHERE t.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = t.category_id)`,
    },
    {
      label: "transactions.event_id sin evento",
      sql: `SELECT t.id FROM transactions t WHERE t.event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = t.event_id)`,
    },
    {
      label: "transactions.parent_transaction_id sin padre",
      sql: `SELECT t.id FROM transactions t WHERE t.parent_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions p WHERE p.id = t.parent_transaction_id)`,
    },
    {
      label: "transactions.reimburses_transaction_id sin transacción original",
      sql: `SELECT t.id FROM transactions t WHERE t.reimburses_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions o WHERE o.id = t.reimburses_transaction_id)`,
    },
    {
      label: "categorization_rules.category_id sin categoría",
      sql: `SELECT r.id FROM categorization_rules r WHERE r.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = r.category_id)`,
    },
    {
      label: "recurring_movements.category_id sin categoría",
      sql: `SELECT m.id FROM recurring_movements m WHERE m.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = m.category_id)`,
    },
    {
      label: "asset_history.asset_id sin activo",
      sql: `SELECT h.id FROM asset_history h WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = h.asset_id)`,
    },
    {
      label: "debt_history.debt_id sin deuda",
      sql: `SELECT h.id FROM debt_history h WHERE NOT EXISTS (SELECT 1 FROM debts d WHERE d.id = h.debt_id)`,
    },
    {
      label: "categories.linked_asset_id sin activo",
      sql: `SELECT c.id FROM categories c WHERE c.linked_asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = c.linked_asset_id)`,
    },
  ];

  const findings: Finding[] = [];
  for (const { label, sql } of orphanQueries) {
    const rows = db.prepare(sql).all() as { id: number }[];
    if (rows.length > 0) {
      findings.push({
        severity: "ERROR",
        message: `${label}: ${rows.length} fila(s) — ids ${rows.map((r) => r.id).join(", ")}.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 5: invariante de analysis_amount
// ---------------------------------------------------------------------------
function checkAnalysisAmountInvariant(db: Database.Database): Finding[] {
  // "Devolución de gasto" es un patrón real e intencional: cuando alguien te
  // devuelve tu parte de un gasto grupal, analysis_amount se guarda en
  // NEGATIVO a propósito para que reste del gasto total en vez de sumar como
  // ingreso aparte — no es un error, así que se excluye de la regla general.
  const rows = db
    .prepare(
      `SELECT id, amount, analysis_amount, impacts_analysis, impact_type FROM transactions
       WHERE impact_type != 'Devolución de gasto'
         AND ((impacts_analysis = 'Sí' AND ROUND(ABS(amount), 2) != ROUND(COALESCE(analysis_amount, -1), 2))
          OR (impacts_analysis != 'Sí' AND COALESCE(analysis_amount, 0) != 0))`
    )
    .all() as { id: number; amount: number; analysis_amount: number | null; impacts_analysis: string }[];

  return rows.map((row) => ({
    severity: "ERROR" as const,
    message: `id=${row.id}: impacts_analysis="${row.impacts_analysis}", amount=${row.amount}, analysis_amount=${row.analysis_amount} — no cumple la regla esperada.`,
  }));
}

// ---------------------------------------------------------------------------
// Chequeo 6: desgloses que no cierran
// ---------------------------------------------------------------------------
function checkSplitIntegrity(db: Database.Database): Finding[] {
  // Antes de que existiera el Desglose de la app, la migración histórica trajo
  // ajustes puntuales (parte propia de un pago grupal, cancelaciones, devoluciones
  // parciales) que también usan parent_transaction_id pero NUNCA prometieron sumar
  // el 100% del padre — se distinguen porque su rule_reason quedó marcado como
  // "Corrección usuario"/"Indicación usuario" en vez de "Desglose ...". Solo se
  // exige la invariante de suma para desgloses reales, creados desde la app.
  const rows = db
    .prepare(
      `SELECT t.id, t.amount,
        (SELECT COALESCE(SUM(c.amount), 0) FROM transactions c
         WHERE c.parent_transaction_id = t.id
           AND c.rule_reason NOT LIKE 'Corrección usuario%'
           AND c.rule_reason NOT LIKE 'Indicación usuario%') AS children_sum,
        (SELECT COUNT(*) FROM transactions c WHERE c.parent_transaction_id = t.id
           AND c.rule_reason NOT LIKE 'Corrección usuario%'
           AND c.rule_reason NOT LIKE 'Indicación usuario%') AS children_count
       FROM transactions t
       WHERE EXISTS (
         SELECT 1 FROM transactions c WHERE c.parent_transaction_id = t.id
           AND c.rule_reason NOT LIKE 'Corrección usuario%'
           AND c.rule_reason NOT LIKE 'Indicación usuario%'
       )`
    )
    .all() as { id: number; amount: number; children_sum: number; children_count: number }[];

  return rows
    .filter((row) => Math.abs(row.amount - row.children_sum) > BALANCE_CHAIN_TOLERANCE)
    .map((row) => ({
      severity: "ERROR" as const,
      message: `id=${row.id}: monto original ${row.amount}, hijos suman ${row.children_sum} (${row.children_count} hijo(s)).`,
    }));
}

// ---------------------------------------------------------------------------
// Chequeo 7: reintegros sospechosos
// ---------------------------------------------------------------------------
function checkReimbursements(db: Database.Database, now: Date): Finding[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.date, t.reimbursement_expected,
        (SELECT COALESCE(SUM(r.amount), 0) FROM transactions r WHERE r.reimburses_transaction_id = t.id) AS reimbursed_sum
       FROM transactions t
       WHERE t.reimbursement_expected IS NOT NULL`
    )
    .all() as { id: number; date: string; reimbursement_expected: number; reimbursed_sum: number }[];

  const findings: Finding[] = [];
  for (const row of rows) {
    if (row.reimbursed_sum > row.reimbursement_expected * REIMBURSEMENT_OVER_FACTOR) {
      findings.push({
        severity: "WARNING",
        message: `id=${row.id} (${row.date}): esperaba ${row.reimbursement_expected}, recibió ${row.reimbursed_sum} — bastante más de lo esperado.`,
      });
    } else if (row.reimbursed_sum === 0 && daysSince(row.date, now) > REIMBURSEMENT_STALE_DAYS) {
      findings.push({
        severity: "WARNING",
        message: `id=${row.id} (${row.date}): esperaba ${row.reimbursement_expected} y hace más de ${REIMBURSEMENT_STALE_DAYS} días sigue en $0.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 8: mp_raw_id duplicado o con formato inesperado
// ---------------------------------------------------------------------------
const MP_RAW_ID_PATTERNS = [
  /^\d+$/, // referencia numérica real de MP
  /^\d+(-[A-Za-z0-9]+)+$/, // hijo de desglose o ajuste histórico: <referencia>-A, -AJ, -dup2, -S-dup2...
  /^recurring-\d+-\d{4}(-\d{2})?$/, // movimiento fijo generado
  /^manual-\d+-[a-z0-9]+$/i, // carga manual
];

function checkMpRawIdIntegrity(db: Database.Database): Finding[] {
  const findings: Finding[] = [];

  const duplicates = db
    .prepare(
      `SELECT mp_raw_id, COUNT(*) AS c FROM transactions WHERE mp_raw_id IS NOT NULL GROUP BY mp_raw_id HAVING c > 1`
    )
    .all() as { mp_raw_id: string; c: number }[];
  for (const dup of duplicates) {
    findings.push({ severity: "ERROR", message: `mp_raw_id "${dup.mp_raw_id}" aparece ${dup.c} veces.` });
  }

  const rows = db
    .prepare(`SELECT id, mp_raw_id FROM transactions WHERE mp_raw_id IS NOT NULL`)
    .all() as { id: number; mp_raw_id: string }[];
  for (const row of rows) {
    if (!MP_RAW_ID_PATTERNS.some((re) => re.test(row.mp_raw_id))) {
      findings.push({
        severity: "WARNING",
        message: `id=${row.id}: mp_raw_id "${row.mp_raw_id}" no matchea ningún formato conocido.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 9: Patrimonio desincronizado con su propio historial
// ---------------------------------------------------------------------------
function checkPatrimonioHistorySync(db: Database.Database): Finding[] {
  const findings: Finding[] = [];
  for (const [table, historyTable, fk] of [
    ["assets", "asset_history", "asset_id"],
    ["debts", "debt_history", "debt_id"],
  ] as const) {
    const rows = db
      .prepare(
        `SELECT a.id, a.name, a.current_value,
          (SELECT h.value FROM ${historyTable} h WHERE h.${fk} = a.id ORDER BY h.recorded_at DESC, h.id DESC LIMIT 1) AS latest
         FROM ${table} a`
      )
      .all() as { id: number; name: string; current_value: number; latest: number | null }[];

    for (const row of rows) {
      if (row.latest === null) {
        findings.push({
          severity: "ERROR",
          message: `${table} "${row.name}" (id=${row.id}) no tiene ninguna fila en ${historyTable}.`,
        });
      } else if (Math.abs(row.current_value - row.latest) > BALANCE_CHAIN_TOLERANCE) {
        findings.push({
          severity: "ERROR",
          message: `${table} "${row.name}" (id=${row.id}): current_value=${row.current_value} pero el historial más reciente dice ${row.latest} — probable edición directa a la DB que no pasó por mutate().`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 10: backup desactualizado
// ---------------------------------------------------------------------------
function checkBackupSync(db: Database.Database): Finding[] {
  // Compara la base que se está auditando (la real por default, o lo que venga
  // por --db) contra la copia de backup — así el chequeo es testeable contra
  // una copia descartable sin tocar la base real.
  let backupDb: Database.Database;
  try {
    backupDb = new Database(BACKUP_DB_PATH, { readonly: true, fileMustExist: true });
  } catch {
    return [{ severity: "WARNING", message: `No se pudo abrir el backup en ${BACKUP_DB_PATH}.` }];
  }

  try {
    const tables = [
      "transactions",
      "assets",
      "debts",
      "categorization_rules",
      "recurring_movements",
      "salary_allocation_runs",
    ];
    const findings: Finding[] = [];
    for (const table of tables) {
      const liveCount = (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
      const backupCount = (backupDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
      if (liveCount !== backupCount) {
        findings.push({
          severity: "WARNING",
          message: `${table}: ${liveCount} filas en la base auditada vs. ${backupCount} en el backup — forzar POST /api/admin/backup-now.`,
        });
      }
    }
    return findings;
  } finally {
    backupDb.close();
  }
}

// ---------------------------------------------------------------------------
// Chequeo 11: sueldo real vs. plantilla de Movimiento fijo
// ---------------------------------------------------------------------------
function checkSalaryTemplateDrift(db: Database.Database): Finding[] {
  const template = db
    .prepare(`SELECT default_amount FROM recurring_movements WHERE description = 'Salario'`)
    .get() as { default_amount: number } | undefined;
  if (!template) return [];

  const lastReal = db
    .prepare(`SELECT amount, date FROM transactions WHERE description = 'Salario' ORDER BY date DESC, id DESC LIMIT 1`)
    .get() as { amount: number; date: string } | undefined;
  if (!lastReal) return [];

  if (Math.abs(template.default_amount - lastReal.amount) > BALANCE_CHAIN_TOLERANCE) {
    return [
      {
        severity: "WARNING",
        message: `La plantilla "Salario" tiene default_amount=${template.default_amount}, pero la última transacción real (${lastReal.date}) fue de ${lastReal.amount} — ¿hubo un aumento sin actualizar la plantilla?`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Chequeo 12: movimientos fijos con huecos
// ---------------------------------------------------------------------------
function periodsBetween(start: Date, end: Date, frequency: "mensual" | "anual"): string[] {
  const periods: string[] = [];
  if (frequency === "mensual") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      periods.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      periods.push(String(year));
    }
  }
  // El período actual todavía puede estar legítimamente pendiente de generar — no es un hueco.
  periods.pop();
  return periods;
}

function checkRecurringMovementGaps(db: Database.Database, now: Date): Finding[] {
  const movements = db
    .prepare(
      `SELECT id, description, frequency, month_of_year, created_at FROM recurring_movements WHERE active = 1`
    )
    .all() as { id: number; description: string; frequency: "mensual" | "anual"; month_of_year: number | null; created_at: string }[];

  const existingIds = new Set(
    (db.prepare(`SELECT mp_raw_id FROM transactions WHERE mp_raw_id LIKE 'recurring-%'`).all() as { mp_raw_id: string }[]).map(
      (row) => row.mp_raw_id
    )
  );

  const findings: Finding[] = [];
  for (const movement of movements) {
    const createdAt = new Date(movement.created_at.replace(" ", "T"));
    const periods = periodsBetween(createdAt, now, movement.frequency).filter((period) => {
      if (movement.frequency === "anual" && movement.month_of_year) {
        const year = Number(period);
        const monthPassed =
          year < now.getFullYear() || (year === now.getFullYear() && now.getMonth() + 1 >= movement.month_of_year);
        return monthPassed;
      }
      return true;
    });
    const missing = periods.filter((period) => !existingIds.has(`recurring-${movement.id}-${period}`));
    if (missing.length > 0) {
      findings.push({
        severity: "WARNING",
        message: `"${movement.description}" (id=${movement.id}): no hay transacción para ${missing.join(", ")}.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 13: Reparto de sueldo — porcentajes fuera de rango
// ---------------------------------------------------------------------------
function checkSalaryAllocationPercentages(db: Database.Database, now: Date): Finding[] {
  const buckets = db
    .prepare(`SELECT key, label, percentage, active_months, sub_allocations FROM salary_allocation_buckets`)
    .all() as {
    key: string;
    label: string;
    percentage: number | null;
    active_months: string | null;
    sub_allocations: string | null;
  }[];

  const findings: Finding[] = [];
  let activeSum = 0;
  for (const bucket of buckets) {
    if (bucket.percentage === null) continue;
    const activeMonths = bucket.active_months ? bucket.active_months.split(",").map(Number) : null;
    const isActive = !activeMonths || activeMonths.includes(now.getMonth() + 1);
    if (!isActive) continue;

    activeSum += bucket.percentage;
    if (bucket.percentage > BUCKET_PERCENTAGE_WARN_THRESHOLD) {
      findings.push({
        severity: "WARNING",
        message: `Sobre "${bucket.label}" tiene ${bucket.percentage}% — inusualmente alto, ¿fue un error de tipeo?`,
      });
    }

    if (bucket.sub_allocations) {
      const subs = JSON.parse(bucket.sub_allocations) as { label: string; percentage: number }[];
      const subSum = subs.reduce((sum, sub) => sum + sub.percentage, 0);
      if (Math.abs(subSum - 100) > 0.01) {
        findings.push({
          severity: "WARNING",
          message: `El desglose interno de "${bucket.label}" suma ${subSum}%, no 100%.`,
        });
      }
    }
  }

  if (activeSum > 100) {
    findings.push({
      severity: "ERROR",
      message: `Los sobres activos de este mes suman ${activeSum}% del sueldo — el "resto" quedaría negativo.`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 14: Reparto de sueldo — pockets de MP desactualizados (necesita confirmación externa)
// ---------------------------------------------------------------------------
function checkStalePockets(db: Database.Database, now: Date): Finding[] {
  const buckets = db
    .prepare(`SELECT key, label, pocket_keywords FROM salary_allocation_buckets WHERE pocket_keywords IS NOT NULL`)
    .all() as { key: string; label: string; pocket_keywords: string }[];

  const findings: Finding[] = [];
  for (const bucket of buckets) {
    // Si ya hay una confirmación reciente (ver getEstimatedPocketBalance en
    // lib/salaryAllocation.ts), el saldo en vivo ya es una estimación con
    // rendimientos incluidos, respaldada por un chequeo manual de Juan — no
    // hace falta pedir otra confirmación hasta que esa venza (misma ventana
    // de 90 días que usa el recordatorio de la pantalla).
    const confirmation = db
      .prepare(
        `SELECT confirmed_at FROM salary_allocation_confirmations WHERE bucket_key = ? ORDER BY confirmed_at DESC, id DESC LIMIT 1`
      )
      .get(bucket.key) as { confirmed_at: string } | undefined;
    if (confirmation && daysSince(confirmation.confirmed_at, now) <= 90) continue;

    const keywords = JSON.parse(bucket.pocket_keywords) as string[];
    const conditions = keywords
      .map(() => "(description LIKE 'Dinero reservado ' || ? || '%' OR description LIKE 'Dinero retirado ' || ? || '%')")
      .join(" OR ");
    const params = keywords.flatMap((keyword) => [keyword, keyword]);
    const row = db.prepare(`SELECT MAX(date) AS lastDate FROM transactions WHERE ${conditions}`).get(...params) as {
      lastDate: string | null;
    };

    if (!row.lastDate) {
      findings.push({
        severity: "NEEDS_CONFIRMATION",
        message: `Sobre "${bucket.label}": nunca tuvo actividad detectada — confirmar contra la app de MP.`,
      });
    } else if (daysSince(row.lastDate, now) > POCKET_STALE_DAYS) {
      findings.push({
        severity: "NEEDS_CONFIRMATION",
        message: `Sobre "${bucket.label}": última actividad ${row.lastDate} (hace más de ${POCKET_STALE_DAYS} días) — confirmar el saldo real en la app de MP.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 15: Reparto de sueldo — confirmaciones de saldo vencidas (necesita confirmación externa)
//
// Distinto del chequeo anterior: acá el sobre SÍ tiene una confirmación
// (`salary_allocation_confirmations`), pero ya pasaron los 90 días de margen
// — la estimación con rendimientos sigue proyectándose, pero conviene
// chequear que no se haya ido de rango (ver docs/reparto-sueldo.md).
// ---------------------------------------------------------------------------
function checkExpiredConfirmations(db: Database.Database, now: Date): Finding[] {
  const rows = db
    .prepare(
      `SELECT b.label, c.confirmed_at, c.confirmed_balance
       FROM salary_allocation_confirmations c
       JOIN salary_allocation_buckets b ON b.key = c.bucket_key
       WHERE c.id IN (
         SELECT MAX(id) FROM salary_allocation_confirmations GROUP BY bucket_key
       )`
    )
    .all() as { label: string; confirmed_at: string; confirmed_balance: number }[];

  return rows
    .filter((row) => daysSince(row.confirmed_at, now) > 90)
    .map((row) => ({
      severity: "NEEDS_CONFIRMATION" as const,
      message: `Sobre "${row.label}": confirmaste $${row.confirmed_balance} el ${row.confirmed_at.slice(0, 10)}, hace más de 90 días — volvé a confirmar el saldo real.`,
    }));
}

// ---------------------------------------------------------------------------
// Chequeo 16: Patrimonio — cuentas sin actualizar hace mucho (necesita confirmación externa)
// ---------------------------------------------------------------------------
function checkStaleAccounts(db: Database.Database, now: Date): Finding[] {
  const findings: Finding[] = [];
  for (const table of ["assets", "debts"] as const) {
    const rows = db
      .prepare(`SELECT id, name, updated_at FROM ${table} WHERE included_in_balance = 1`)
      .all() as { id: number; name: string; updated_at: string }[];
    for (const row of rows) {
      if (daysSince(row.updated_at, now) > ACCOUNT_STALE_DAYS) {
        findings.push({
          severity: "NEEDS_CONFIRMATION",
          message: `${table === "assets" ? "Activo" : "Deuda"} "${row.name}" sin actualizar desde ${row.updated_at} — confirmar el valor real.`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Chequeo 17: transacciones "Pendiente" que envejecen
// ---------------------------------------------------------------------------
function checkAgingPendientes(db: Database.Database, now: Date): Finding[] {
  const rows = db
    .prepare(`SELECT id, date, description FROM transactions WHERE impacts_analysis = 'Pendiente' ORDER BY date ASC`)
    .all() as { id: number; date: string; description: string }[];

  const old = rows.filter((row) => daysSince(row.date, now) > PENDIENTE_AGE_DAYS);
  if (old.length === 0) return [];

  const examples = old
    .slice(0, 5)
    .map((row) => `id=${row.id} (${row.date}, "${row.description}")`)
    .join("; ");
  return [
    {
      severity: "WARNING",
      message: `${old.length} transacción(es) "Pendiente" con más de ${PENDIENTE_AGE_DAYS} días. Ejemplos: ${examples}.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Registro de chequeos — agregar acá cualquier chequeo nuevo, nada más hace falta tocar.
// ---------------------------------------------------------------------------
function buildChecks(now: Date): Check[] {
  return [
    { name: "Cadena de saldos", run: (db) => checkBalanceChain(db) },
    { name: "Descripciones con firma de parseo roto", run: (db) => checkBrokenDescriptions(db) },
    { name: "Reglas huérfanas por truncamiento", run: (db) => checkTruncatedRules(db) },
    { name: "Referencias colgantes", run: (db) => checkOrphanedReferences(db) },
    { name: "Invariante analysis_amount", run: (db) => checkAnalysisAmountInvariant(db) },
    { name: "Desgloses que no cierran", run: (db) => checkSplitIntegrity(db) },
    { name: "Reintegros sospechosos", run: (db) => checkReimbursements(db, now) },
    { name: "mp_raw_id duplicado/formato raro", run: (db) => checkMpRawIdIntegrity(db) },
    { name: "Patrimonio desincronizado con su historial", run: (db) => checkPatrimonioHistorySync(db) },
    { name: "Backup desactualizado", run: (db) => checkBackupSync(db) },
    { name: "Sueldo real vs. plantilla", run: (db) => checkSalaryTemplateDrift(db) },
    { name: "Movimientos fijos con huecos", run: (db) => checkRecurringMovementGaps(db, now) },
    { name: "Reparto de sueldo: porcentajes fuera de rango", run: (db) => checkSalaryAllocationPercentages(db, now) },
    { name: "Reparto de sueldo: pockets desactualizados", run: (db) => checkStalePockets(db, now) },
    { name: "Reparto de sueldo: confirmaciones vencidas", run: (db) => checkExpiredConfirmations(db, now) },
    { name: "Patrimonio: cuentas sin actualizar", run: (db) => checkStaleAccounts(db, now) },
    { name: "Pendientes que envejecen", run: (db) => checkAgingPendientes(db, now) },
  ];
}

// ---------------------------------------------------------------------------
// Runner + reporte
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): { dbPath: string } {
  const dbFlagIndex = argv.indexOf("--db");
  const dbPath = dbFlagIndex >= 0 ? argv[dbFlagIndex + 1] : DEFAULT_DB_PATH;
  return { dbPath };
}

function main(): void {
  const { dbPath } = parseArgs(process.argv.slice(2));
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const now = new Date();

  let errorCount = 0;
  let warningCount = 0;
  let confirmCount = 0;
  let okCount = 0;

  console.log(`Auditoría de integridad — ${dbPath}\n`);

  for (const check of buildChecks(now)) {
    const findings = check.run(db);
    if (findings.length === 0) {
      okCount += 1;
      console.log(`OK   ${check.name}`);
      continue;
    }
    console.log(`--   ${check.name}`);
    for (const finding of findings) {
      if (finding.severity === "ERROR") errorCount += 1;
      else if (finding.severity === "WARNING") warningCount += 1;
      else confirmCount += 1;
      console.log(`  [${finding.severity}] ${finding.message}`);
    }
  }

  db.close();

  console.log(
    `\nResumen: ${errorCount} error(es), ${warningCount} advertencia(s), ${confirmCount} para confirmar con Juan, ${okCount} chequeo(s) OK.`
  );

  if (errorCount > 0) process.exit(1);
}

if (require.main === module) {
  main();
}

export { buildChecks, type Finding, type Severity };
