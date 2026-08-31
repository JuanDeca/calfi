import { db, mutate } from "@/lib/db";
import { extractCounterparty, getUnknownCounterpartyKeys } from "@/lib/categorization";
import type { Transaction } from "@/types/transaction";

interface TransactionRow {
  id: number;
  date: string;
  description: string;
  mp_reference: string | null;
  amount: number;
  running_balance: number | null;
  category_id: number | null;
  category_name: string | null;
  subcategory: string | null;
  rule_reason: string | null;
  impacts_analysis: Transaction["impactsAnalysis"];
  impact_type: string | null;
  impact_reason: string | null;
  analysis_amount: number | null;
  expense_class: Transaction["expenseClass"];
  event_id: number | null;
  parent_transaction_id: number | null;
  source_file: string | null;
  mp_raw_id: string | null;
  created_at: string;
  reimburses_transaction_id: number | null;
  reimburses_description: string | null;
  reimbursement_expected: number | null;
  reimbursed_sum: number;
  has_split_children: number;
  notes: string | null;
  original_amount_usd: number | null;
  usd_exchange_rate: number | null;
}

const SELECT_TRANSACTIONS = `
  SELECT
    t.id, t.date, t.description, t.mp_reference, t.amount, t.running_balance,
    t.category_id, c.name AS category_name, t.subcategory,
    t.rule_reason, t.impacts_analysis, t.impact_type, t.impact_reason,
    t.analysis_amount, t.expense_class, t.event_id, t.parent_transaction_id,
    t.source_file, t.mp_raw_id, t.created_at,
    t.reimburses_transaction_id, rt.description AS reimburses_description,
    t.reimbursement_expected,
    (SELECT COALESCE(SUM(r.amount), 0) FROM transactions r WHERE r.reimburses_transaction_id = t.id) AS reimbursed_sum,
    EXISTS(SELECT 1 FROM transactions s WHERE s.parent_transaction_id = t.id) AS has_split_children,
    t.notes, t.original_amount_usd, t.usd_exchange_rate
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN transactions rt ON rt.id = t.reimburses_transaction_id
  ORDER BY t.date DESC, t.id DESC
`;

function toTransaction(row: TransactionRow, unknownKeys: Set<string>): Transaction {
  const counterparty = extractCounterparty(row.description);
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    mpReference: row.mp_reference,
    amount: row.amount,
    runningBalance: row.running_balance,
    categoryId: row.category_id,
    categoryName: row.category_name,
    subcategory: row.subcategory,
    ruleReason: row.rule_reason,
    impactsAnalysis: row.impacts_analysis,
    impactType: row.impact_type,
    impactReason: row.impact_reason,
    analysisAmount: row.analysis_amount,
    expenseClass: row.expense_class,
    eventId: row.event_id,
    parentTransactionId: row.parent_transaction_id,
    sourceFile: row.source_file,
    mpRawId: row.mp_raw_id,
    createdAt: row.created_at,
    counterparty,
    reimbursesTransactionId: row.reimburses_transaction_id,
    reimbursesDescription: row.reimburses_description,
    reimbursementExpected: row.reimbursement_expected,
    reimbursedSum: row.reimbursed_sum,
    hasSplitChildren: row.has_split_children === 1,
    notes: row.notes,
    originalAmountUsd: row.original_amount_usd,
    usdExchangeRate: row.usd_exchange_rate,
    hasUnknownHistory: row.subcategory !== "Desconocidos" && unknownKeys.has(counterparty),
  };
}

export function setTransactionNotes(id: number, notes: string | null): void {
  mutate((connection) => {
    connection.prepare("UPDATE transactions SET notes = ? WHERE id = ?").run(notes, id);
  });
}

/**
 * Solo permite borrar transacciones cargadas a mano (`source_file = 'Carga manual'`) —
 * las importadas de Mercado Pago no se tocan, para no perder el historial real ni
 * arriesgar reimportarlas duplicadas más adelante. Bloquea además los casos donde
 * borrarla dejaría datos huérfanos (desgloses, reintegros vinculados).
 */
export function deleteManualTransaction(id: number): { error?: string } {
  const transaction = getTransactionById(id);
  if (!transaction) return { error: "Transacción no encontrada." };
  if (transaction.sourceFile !== "Carga manual") {
    return { error: "Solo se pueden eliminar transacciones cargadas a mano." };
  }
  if (transaction.hasSplitChildren) {
    return { error: "Esta transacción está desglosada — deshacé el desglose antes de eliminarla." };
  }
  if (transaction.parentTransactionId !== null) {
    return { error: "Es parte de un desglose — no se puede eliminar una sola parte." };
  }
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE reimburses_transaction_id = ?")
    .get(id) as { count: number };
  if (count > 0) {
    return { error: "Tiene reintegros vinculados — desvinculalos antes de eliminarla." };
  }

  mutate((connection) => {
    connection.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  });
  return {};
}

export interface TransactionFilters {
  search?: string;
  categoryId?: number;
  subcategory?: string;
  expenseClass?: string;
  impactsAnalysis?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildWhereClause(filters: TransactionFilters): {
  whereClause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.search) {
    conditions.push("t.description LIKE ?");
    params.push(`%${filters.search}%`);
  }
  if (filters.categoryId !== undefined) {
    conditions.push("t.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.subcategory === "__none__") {
    conditions.push("t.subcategory IS NULL");
  } else if (filters.subcategory) {
    conditions.push("t.subcategory = ?");
    params.push(filters.subcategory);
  }
  if (filters.expenseClass) {
    conditions.push("t.expense_class = ?");
    params.push(filters.expenseClass);
  }
  if (filters.impactsAnalysis) {
    conditions.push("t.impacts_analysis = ?");
    params.push(filters.impactsAnalysis);
  }
  if (filters.dateFrom) {
    conditions.push("t.date >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("t.date <= ?");
    params.push(filters.dateTo);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export function getTransactions(
  filters: TransactionFilters = {},
  pagination?: Pagination
): Transaction[] {
  const { whereClause, params } = buildWhereClause(filters);
  let query = SELECT_TRANSACTIONS.replace("ORDER BY", `${whereClause} ORDER BY`);
  const allParams = [...params];

  if (pagination) {
    query += " LIMIT ? OFFSET ?";
    allParams.push(pagination.pageSize, (pagination.page - 1) * pagination.pageSize);
  }

  const rows = db.prepare(query).all(...allParams) as TransactionRow[];
  const unknownKeys = getUnknownCounterpartyKeys(db);
  return rows.map((row) => toTransaction(row, unknownKeys));
}

export function getTransactionsCount(filters: TransactionFilters = {}): number {
  const { whereClause, params } = buildWhereClause(filters);
  const { count } = db
    .prepare(`SELECT COUNT(*) AS count FROM transactions t ${whereClause}`)
    .get(...params) as { count: number };
  return count;
}

export function getTransactionById(id: number): Transaction | null {
  const row = db
    .prepare(SELECT_TRANSACTIONS.replace("ORDER BY", "WHERE t.id = ? ORDER BY"))
    .get(id) as TransactionRow | undefined;
  return row ? toTransaction(row, getUnknownCounterpartyKeys(db)) : null;
}

export interface SplitTemplatePart {
  categoryId: number | null;
  categoryName: string | null;
  subcategory: string | null;
  amount: number;
  expenseClass: Transaction["expenseClass"];
}

/**
 * Busca el desglose más reciente de la misma contraparte (ej. la transferencia
 * mensual a Claudio que siempre se parte en seguro/celular/impuesto) para
 * sugerirlo como punto de partida al desglosar una transacción nueva.
 */
export function getLastSplitTemplate(
  currentTransactionId: number,
  counterpartyKey: string
): { parentDate: string; parts: SplitTemplatePart[] } | null {
  const parents = db
    .prepare(
      `
      SELECT DISTINCT t.parent_transaction_id AS id, p.description AS description, p.date AS date
      FROM transactions t
      JOIN transactions p ON p.id = t.parent_transaction_id
      WHERE t.parent_transaction_id IS NOT NULL AND t.parent_transaction_id != ?
    `
    )
    .all(currentTransactionId) as { id: number; description: string; date: string }[];

  const matches = parents
    .filter((parent) => extractCounterparty(parent.description) === counterpartyKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (matches.length === 0) return null;

  const parts = db
    .prepare(
      `
      SELECT t.category_id AS categoryId, c.name AS categoryName, t.subcategory,
        ABS(t.amount) AS amount, t.expense_class AS expenseClass
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.parent_transaction_id = ?
      ORDER BY t.id ASC
    `
    )
    .all(matches[0].id) as SplitTemplatePart[];

  return parts.length > 0 ? { parentDate: matches[0].date, parts } : null;
}

/** Partes de un desglose ya existente, para precargarlas al reabrir "Editar desglose". */
export function getSplitChildren(parentId: number): SplitTemplatePart[] {
  return db
    .prepare(
      `
      SELECT t.category_id AS categoryId, c.name AS categoryName, t.subcategory,
        ABS(t.amount) AS amount, t.expense_class AS expenseClass
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.parent_transaction_id = ?
      ORDER BY t.id ASC
    `
    )
    .all(parentId) as SplitTemplatePart[];
}

const DUDOSOS_FILTER = "t.impacts_analysis = 'Pendiente'";

export function getDudosos(): Transaction[] {
  const rows = db
    .prepare(SELECT_TRANSACTIONS.replace("ORDER BY", `WHERE ${DUDOSOS_FILTER} ORDER BY`))
    .all() as TransactionRow[];
  const unknownKeys = getUnknownCounterpartyKeys(db);
  return rows.map((row) => toTransaction(row, unknownKeys));
}

export function getTransactionsByEvent(eventId: number): Transaction[] {
  const rows = db
    .prepare(SELECT_TRANSACTIONS.replace("ORDER BY", "WHERE t.event_id = ? ORDER BY"))
    .all(eventId) as TransactionRow[];
  const unknownKeys = getUnknownCounterpartyKeys(db);
  return rows.map((row) => toTransaction(row, unknownKeys));
}

export interface TransactionSearchResult {
  id: number;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
}

/**
 * Búsqueda liviana para los modales de vínculo de reintegros: encontrar el gasto
 * que un ingreso reintegra, o encontrar ingresos para vincular a un gasto.
 */
export function searchTransactionsForLink(
  query: string,
  sign: "positive" | "negative",
  excludeId?: number
): TransactionSearchResult[] {
  const amountCondition = sign === "positive" ? "amount > 0" : "amount < 0";
  const rows = db
    .prepare(
      `
      SELECT id, date, description, amount
      FROM transactions
      WHERE ${amountCondition} AND description LIKE ? AND id != ?
      ORDER BY date DESC, id DESC
      LIMIT 25
    `
    )
    .all(`%${query}%`, excludeId ?? -1) as { id: number; date: string; description: string; amount: number }[];

  return rows.map((row) => ({
    ...row,
    counterparty: extractCounterparty(row.description),
  }));
}

export function getReimbursementsFor(expenseId: number): TransactionSearchResult[] {
  const rows = db
    .prepare(
      `
      SELECT id, date, description, amount
      FROM transactions
      WHERE reimburses_transaction_id = ?
      ORDER BY date DESC, id DESC
    `
    )
    .all(expenseId) as { id: number; date: string; description: string; amount: number }[];

  return rows.map((row) => ({
    ...row,
    counterparty: extractCounterparty(row.description),
  }));
}

export function setReimbursementLink(reimbursementId: number, expenseId: number | null): void {
  mutate((connection) => {
    connection
      .prepare("UPDATE transactions SET reimburses_transaction_id = ? WHERE id = ?")
      .run(expenseId, reimbursementId);
  });
}

export function setReimbursementExpected(expenseId: number, amount: number | null): void {
  mutate((connection) => {
    connection
      .prepare("UPDATE transactions SET reimbursement_expected = ? WHERE id = ?")
      .run(amount, expenseId);
  });
}

const REIMBURSEMENT_PENDING_FILTER = `
  reimbursement_expected IS NOT NULL
  AND reimbursement_expected > (
    SELECT COALESCE(SUM(r.amount), 0) FROM transactions r WHERE r.reimburses_transaction_id = transactions.id
  ) + 0.5
`;

export function getPendingReimbursementsCount(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM transactions WHERE ${REIMBURSEMENT_PENDING_FILTER}`)
    .get() as { count: number };
  return row.count;
}
