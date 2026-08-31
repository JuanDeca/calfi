import { db, mutate } from "@/lib/db";
import { isCategoryExcludedFromAnalysis } from "@/lib/categories";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

export interface RecurringMovement {
  id: number;
  description: string;
  defaultAmount: number;
  defaultAmountUsd: number | null;
  categoryId: number | null;
  categoryName: string | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  frequency: "mensual" | "anual";
  dayOfMonth: number;
  monthOfYear: number | null;
  active: boolean;
}

interface Row {
  id: number;
  description: string;
  default_amount: number;
  default_amount_usd: number | null;
  category_id: number | null;
  category_name: string | null;
  subcategory: string | null;
  expense_class: ExpenseClass;
  impacts_analysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  frequency: "mensual" | "anual";
  day_of_month: number;
  month_of_year: number | null;
  active: number;
}

function toMovement(row: Row): RecurringMovement {
  return {
    id: row.id,
    description: row.description,
    defaultAmount: row.default_amount,
    defaultAmountUsd: row.default_amount_usd,
    categoryId: row.category_id,
    categoryName: row.category_name,
    subcategory: row.subcategory,
    expenseClass: row.expense_class,
    impactsAnalysis: row.impacts_analysis,
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    monthOfYear: row.month_of_year,
    active: row.active === 1,
  };
}

const SELECT = `
  SELECT r.id, r.description, r.default_amount, r.default_amount_usd, r.category_id, c.name AS category_name,
    r.subcategory, r.expense_class, r.impacts_analysis, r.frequency, r.day_of_month,
    r.month_of_year, r.active
  FROM recurring_movements r
  LEFT JOIN categories c ON c.id = r.category_id
  ORDER BY r.description
`;

export function getRecurringMovements(): RecurringMovement[] {
  return (db.prepare(SELECT).all() as Row[]).map(toMovement);
}

export function createRecurringMovement(input: {
  description: string;
  defaultAmount: number;
  defaultAmountUsd?: number | null;
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  frequency: "mensual" | "anual";
  dayOfMonth: number;
  monthOfYear: number | null;
}): number {
  return mutate((connection) => {
    const info = connection
      .prepare(
        `
        INSERT INTO recurring_movements (
          description, default_amount, default_amount_usd, category_id, subcategory, expense_class,
          impacts_analysis, frequency, day_of_month, month_of_year
        ) VALUES (
          @description, @defaultAmount, @defaultAmountUsd, @categoryId, @subcategory, @expenseClass,
          @impactsAnalysis, @frequency, @dayOfMonth, @monthOfYear
        )
      `
      )
      .run({ ...input, defaultAmountUsd: input.defaultAmountUsd ?? null });
    return Number(info.lastInsertRowid);
  });
}

export function setRecurringMovementActive(id: number, active: boolean): void {
  mutate((connection) => {
    connection.prepare("UPDATE recurring_movements SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  });
}

export function updateRecurringMovement(
  id: number,
  input: {
    description: string;
    defaultAmount: number;
    defaultAmountUsd?: number | null;
    categoryId: number | null;
    subcategory: string | null;
    expenseClass: ExpenseClass;
    impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
    frequency: "mensual" | "anual";
    dayOfMonth: number;
    monthOfYear: number | null;
  }
): void {
  mutate((connection) => {
    connection
      .prepare(
        `
        UPDATE recurring_movements SET
          description = @description, default_amount = @defaultAmount, default_amount_usd = @defaultAmountUsd,
          category_id = @categoryId, subcategory = @subcategory, expense_class = @expenseClass,
          impacts_analysis = @impactsAnalysis, frequency = @frequency, day_of_month = @dayOfMonth,
          month_of_year = @monthOfYear
        WHERE id = @id
      `
      )
      .run({ ...input, defaultAmountUsd: input.defaultAmountUsd ?? null, id });
  });
}

export function deleteRecurringMovement(id: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM recurring_movements WHERE id = ?").run(id);
  });
}

function currentPeriod(movement: RecurringMovement, now: Date): string {
  const year = now.getFullYear();
  if (movement.frequency === "anual") return String(year);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isDue(movement: RecurringMovement, now: Date): boolean {
  if (movement.frequency === "mensual") return true;
  const currentMonth = now.getMonth() + 1;
  return currentMonth >= (movement.monthOfYear ?? 1);
}

/** Fecha real del movimiento (el día configurado en la plantilla, no el
 * momento en que se apretó "Generar") — si Juan genera varias plantillas
 * juntas un día cualquiera, cada una conserva su propio día del mes en vez
 * de que todas queden fechadas ese mismo día. */
function movementDate(movement: RecurringMovement, now: Date): string {
  const year = now.getFullYear();
  const month = movement.frequency === "anual" ? (movement.monthOfYear ?? 1) : now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(movement.dayOfMonth).padStart(2, "0")}`;
}

export interface PendingRecurringMovement {
  movement: RecurringMovement;
  period: string;
}

/** Plantillas activas que ya están "en fecha" pero todavía no generaron su transacción de este período. */
export function getPendingRecurringMovements(now = new Date()): PendingRecurringMovement[] {
  const movements = getRecurringMovements().filter((movement) => movement.active && isDue(movement, now));
  const existing = db
    .prepare("SELECT mp_raw_id FROM transactions WHERE mp_raw_id LIKE 'recurring-%'")
    .all() as { mp_raw_id: string }[];
  const existingIds = new Set(existing.map((row) => row.mp_raw_id));

  return movements
    .map((movement) => ({ movement, period: currentPeriod(movement, now) }))
    .filter(({ movement, period }) => !existingIds.has(`recurring-${movement.id}-${period}`));
}

export function generateRecurringMovement(
  movementId: number,
  amount: number,
  now = new Date(),
  usd?: { originalAmountUsd: number | null; usdExchangeRate: number | null }
): { id: number } {
  const movement = getRecurringMovements().find((m) => m.id === movementId);
  if (!movement) throw new Error("Plantilla no encontrada.");

  const period = currentPeriod(movement, now);
  const mpRawId = `recurring-${movementId}-${period}`;
  const date = movementDate(movement, now);

  let impactsAnalysis = movement.impactsAnalysis;
  if (isCategoryExcludedFromAnalysis(movement.categoryId)) {
    impactsAnalysis = "No";
  }
  const isCountedExpense = impactsAnalysis === "Sí";
  const impactType = isCountedExpense
    ? amount > 0
      ? "Ingreso real"
      : "Gasto real"
    : "Transferencia interna";
  const impactReason = isCountedExpense
    ? amount > 0
      ? "Ingreso confirmado del período."
      : "Movimiento confirmado que representa consumo/gasto del período."
    : "Movimiento propio o entre cuentas; no representa gasto real.";

  return mutate((connection) => {
    const info = connection
      .prepare(
        `
        INSERT INTO transactions (
          date, description, mp_reference, amount, running_balance,
          category_id, subcategory, rule_reason,
          impacts_analysis, impact_type, impact_reason, analysis_amount,
          expense_class, source_file, mp_raw_id, original_amount_usd, usd_exchange_rate
        ) VALUES (
          @date, @description, NULL, @amount, NULL,
          @categoryId, @subcategory, 'Movimiento fijo recurrente',
          @impactsAnalysis, @impactType, @impactReason, @analysisAmount,
          @expenseClass, 'Movimiento fijo recurrente', @mpRawId, @originalAmountUsd, @usdExchangeRate
        )
      `
      )
      .run({
        date,
        description: movement.description,
        amount,
        categoryId: movement.categoryId,
        subcategory: movement.subcategory,
        impactsAnalysis,
        impactType,
        impactReason,
        analysisAmount: isCountedExpense ? Math.abs(amount) : 0,
        expenseClass: movement.expenseClass,
        mpRawId,
        originalAmountUsd: usd?.originalAmountUsd ?? null,
        usdExchangeRate: usd?.usdExchangeRate ?? null,
      });
    return { id: Number(info.lastInsertRowid) };
  });
}
