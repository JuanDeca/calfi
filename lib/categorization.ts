import type Database from "better-sqlite3";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

// El orden importa: los prefijos más específicos van antes que "Pago " a
// secas, porque si no "Pago con QR YPF" se corta mal como "con QR YPF".
const COUNTERPARTY_PREFIXES = [
  "Transferencia enviada ",
  "Transferencia recibida ",
  "Pago con Pix ",
  "Pago con QR ",
  "Pago de servicio ",
  "Dinero retirado ",
  "Pago ",
];

export function extractCounterparty(description: string): string {
  for (const prefix of COUNTERPARTY_PREFIXES) {
    if (description.startsWith(prefix)) {
      return description.slice(prefix.length).trim();
    }
  }
  return description;
}

/** Devuelve el id de la categoría, creándola si no existe (INSERT OR IGNORE + SELECT). */
export function getOrCreateCategoryId(
  db: Database.Database,
  name: string,
  type: "gasto" | "ingreso" = "gasto"
): number {
  db.prepare(
    "INSERT OR IGNORE INTO categories (name, type) VALUES (@name, @type)"
  ).run({ name, type });
  const row = db
    .prepare("SELECT id FROM categories WHERE name = ?")
    .get(name) as { id: number };
  return row.id;
}

// Plata que se mueve entre reservas propias de MP ("Dinero reservado Mejoras",
// "Dinero retirado Moto", etc.) — el nombre de la reserva varía todo el tiempo,
// así que no sirve una regla por contraparte: se detecta por el prefijo de la
// descripción, sin importar cómo se llame la reserva.
const RESERVE_MOVEMENT_PREFIXES = ["Dinero reservado ", "Dinero retirado "];
const RESERVE_MOVEMENT_CATEGORY_NAME = "Movimiento entre cuentas/reservas";

export function isReserveMovement(description: string): boolean {
  return RESERVE_MOVEMENT_PREFIXES.some((prefix) => description.startsWith(prefix));
}

export function getReserveMovementCategoryId(db: Database.Database): number {
  db.prepare(
    "INSERT OR IGNORE INTO categories (name, type, excluded_from_analysis) VALUES (?, 'gasto', 1)"
  ).run(RESERVE_MOVEMENT_CATEGORY_NAME);
  const row = db
    .prepare("SELECT id FROM categories WHERE name = ?")
    .get(RESERVE_MOVEMENT_CATEGORY_NAME) as { id: number };
  return row.id;
}

export interface CategorizationRule {
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: ImpactsAnalysis;
}

interface CategorizationRuleRow {
  category_id: number | null;
  subcategory: string | null;
  expense_class: ExpenseClass;
  impacts_analysis: ImpactsAnalysis;
}

export function findCategorizationRule(
  db: Database.Database,
  counterpartyKey: string
): CategorizationRule | null {
  const row = db
    .prepare(
      "SELECT category_id, subcategory, expense_class, impacts_analysis FROM categorization_rules WHERE counterparty_key = ?"
    )
    .get(counterpartyKey) as CategorizationRuleRow | undefined;

  if (!row) return null;

  return {
    categoryId: row.category_id,
    subcategory: row.subcategory,
    expenseClass: row.expense_class,
    impactsAnalysis: row.impacts_analysis,
  };
}

export interface ImportResolution {
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: ImpactsAnalysis;
  ruleReason: string | null;
}

/**
 * Resuelve cómo categorizar una transacción nueva al importar: primero busca
 * una regla aprendida por contraparte, y si no hay, chequea si es un
 * movimiento de reserva (por patrón de descripción, no por contraparte). Si
 * ninguna aplica, queda Pendiente para revisión manual — pero siempre se
 * puede recategorizar a mano después, esto es solo el valor por defecto.
 */
export function resolveImportCategorization(
  db: Database.Database,
  description: string
): ImportResolution {
  const rule = findCategorizationRule(db, extractCounterparty(description));
  if (rule) {
    return { ...rule, ruleReason: "Regla aprendida" };
  }

  if (isReserveMovement(description)) {
    return {
      categoryId: getReserveMovementCategoryId(db),
      subcategory: null,
      expenseClass: "No aplica",
      impactsAnalysis: "No",
      ruleReason: "Movimiento de reserva/retiro detectado automáticamente",
    };
  }

  return {
    categoryId: null,
    subcategory: null,
    expenseClass: "No aplica",
    impactsAnalysis: "Pendiente",
    ruleReason: null,
  };
}

/** Crea o actualiza la regla aprendida para una contraparte (INSERT ... ON CONFLICT). */
export function upsertCategorizationRule(
  db: Database.Database,
  counterpartyKey: string,
  rule: CategorizationRule
): void {
  db.prepare(
    `
    INSERT INTO categorization_rules (counterparty_key, category_id, subcategory, expense_class, impacts_analysis)
    VALUES (@counterpartyKey, @categoryId, @subcategory, @expenseClass, @impactsAnalysis)
    ON CONFLICT(counterparty_key) DO UPDATE SET
      category_id = excluded.category_id,
      subcategory = excluded.subcategory,
      expense_class = excluded.expense_class,
      impacts_analysis = excluded.impacts_analysis
  `
  ).run({ counterpartyKey, ...rule });
}

/**
 * Aplica una regla a todas las transacciones pendientes de la misma contraparte
 * (usado tanto al categorizar una transacción real como al crear una regla a mano).
 * Si `includeAlreadyCategorized` es true, también reescribe transacciones de esa
 * contraparte que ya tenían otra categoría asignada (no solo las `Pendiente`).
 * Devuelve la cantidad de transacciones actualizadas.
 */
export function applyRuleRetroactively(
  db: Database.Database,
  counterpartyKey: string,
  rule: CategorizationRule,
  excludeId?: number,
  includeAlreadyCategorized = false
): number {
  const candidates = db
    .prepare(
      includeAlreadyCategorized
        ? "SELECT id, description, amount FROM transactions WHERE id != ?"
        : "SELECT id, description, amount FROM transactions WHERE impacts_analysis = 'Pendiente' AND id != ?"
    )
    .all(excludeId ?? -1) as { id: number; description: string; amount: number }[];

  const update = db.prepare(
    `
    UPDATE transactions SET
      category_id = @categoryId, subcategory = @subcategory,
      rule_reason = @ruleReason, impacts_analysis = @impactsAnalysis, impact_type = @impactType,
      impact_reason = @impactReason, analysis_amount = @analysisAmount, expense_class = @expenseClass
    WHERE id = @id
  `
  );

  let applied = 0;
  for (const candidate of candidates) {
    if (extractCounterparty(candidate.description) !== counterpartyKey) continue;
    const impactType =
      rule.impactsAnalysis === "Sí"
        ? candidate.amount > 0
          ? "Ingreso real"
          : "Gasto real"
        : "Transferencia interna";
    const impactReason =
      rule.impactsAnalysis === "Sí"
        ? candidate.amount > 0
          ? "Ingreso confirmado del período."
          : "Movimiento confirmado que representa consumo/gasto del período."
        : "Movimiento propio o entre cuentas; no representa gasto real.";
    update.run({
      id: candidate.id,
      categoryId: rule.categoryId,
      subcategory: rule.subcategory,
      ruleReason: "Regla aprendida",
      impactsAnalysis: rule.impactsAnalysis,
      impactType,
      impactReason,
      analysisAmount: rule.impactsAnalysis === "Sí" ? Math.abs(candidate.amount) : 0,
      expenseClass: rule.expenseClass,
    });
    applied += 1;
  }
  return applied;
}

/**
 * Cuenta cuántas transacciones de la misma contraparte ya tienen otra categoría
 * asignada (no `Pendiente`) — usado para avisar antes de aplicar una recategorización
 * masiva sobre lo ya categorizado.
 */
export function countAlreadyCategorized(
  db: Database.Database,
  counterpartyKey: string,
  excludeId?: number
): number {
  const rows = db
    .prepare(
      "SELECT description FROM transactions WHERE impacts_analysis != 'Pendiente' AND id != ?"
    )
    .all(excludeId ?? -1) as { description: string }[];
  return rows.filter((row) => extractCounterparty(row.description) === counterpartyKey).length;
}

/**
 * Cuenta cuántas transacciones de la misma contraparte siguen `Pendiente` —
 * usado para sugerir, antes de guardar, que categorizar esta transacción
 * (con "recordar" tildado) también va a resolver esas otras.
 */
export function countPendienteForCounterparty(
  db: Database.Database,
  counterpartyKey: string,
  excludeId?: number
): number {
  const rows = db
    .prepare("SELECT description FROM transactions WHERE impacts_analysis = 'Pendiente' AND id != ?")
    .all(excludeId ?? -1) as { description: string }[];
  return rows.filter((row) => extractCounterparty(row.description) === counterpartyKey).length;
}

/**
 * Cantidad de transacciones que matchean cada contraparte — para la columna
 * "Apariciones" de la pantalla de Reglas. `extractCounterparty` es una función
 * JS, no una expresión SQL, así que agrupamos en memoria en vez de un GROUP BY.
 */
export function getCounterpartyOccurrenceCounts(db: Database.Database): Map<string, number> {
  const rows = db.prepare("SELECT description FROM transactions").all() as { description: string }[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = extractCounterparty(row.description);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Contrapartes que ya tienen alguna transacción marcada subcategoría "Desconocidos"
 * (pago que Juan no recordaba de qué se trataba) — para avisar cuando aparece una
 * transacción nueva de la misma persona, por si la más reciente ayuda a recordar
 * la vieja. Igual que otras funciones acá, agrupa en memoria porque
 * `extractCounterparty` es JS, no una expresión SQL.
 */
export function getUnknownCounterpartyKeys(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT DISTINCT description FROM transactions WHERE subcategory = 'Desconocidos'")
    .all() as { description: string }[];
  return new Set(rows.map((row) => extractCounterparty(row.description)));
}

export interface PreviousCounterpartyTransaction {
  id: number;
  date: string;
  amount: number;
  categoryName: string | null;
  subcategory: string | null;
  notes: string | null;
}

/**
 * Últimas transacciones de la misma contraparte (excluyendo la actual) — para
 * mostrar "así la categoricé la vez pasada" al abrir el modal de categorización.
 * Igual que `getCounterpartyOccurrenceCounts`, agrupa en memoria porque
 * `extractCounterparty` es una función JS, no una expresión SQL.
 */
export function getPreviousTransactionsForCounterparty(
  db: Database.Database,
  counterpartyKey: string,
  excludeId: number,
  limit = 8
): PreviousCounterpartyTransaction[] {
  const rows = db
    .prepare(
      `
      SELECT t.id, t.date, t.description, t.amount, c.name AS category_name, t.subcategory, t.notes
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.id != ?
      ORDER BY t.date DESC, t.id DESC
    `
    )
    .all(excludeId) as {
    id: number;
    date: string;
    description: string;
    amount: number;
    category_name: string | null;
    subcategory: string | null;
    notes: string | null;
  }[];

  const matches: PreviousCounterpartyTransaction[] = [];
  for (const row of rows) {
    if (extractCounterparty(row.description) !== counterpartyKey) continue;
    matches.push({
      id: row.id,
      date: row.date,
      amount: row.amount,
      categoryName: row.category_name,
      subcategory: row.subcategory,
      notes: row.notes,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}
