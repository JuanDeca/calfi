import { db } from "@/lib/db";
import { getAdjustmentFactor, type InflationIndex } from "@/lib/inflacion";
import { extractCounterparty } from "@/lib/categorization";
import { isCategoryExcludedFromAnalysis } from "@/lib/categories";

const MAX_CATEGORY_SLOTS = 7;

/**
 * Para una categoría normal, solo cuenta lo que impacta el análisis (una
 * transacción puntual puede quedar marcada "No" como excepción). Pero para una
 * categoría marcada como excluida del análisis por completo (ej. "Inversiones",
 * "Reintegros") TODAS sus transacciones son 'No' a propósito — filtrar por
 * impacts_analysis='Sí' ahí dejaría la categoría siempre vacía en su propia
 * pantalla, aunque tenga movimientos reales.
 */
function categoryScopeClause(categoryId: number): string {
  return isCategoryExcludedFromAnalysis(categoryId)
    ? "category_id = ?"
    : "impacts_analysis = 'Sí' AND category_id = ?";
}

export interface Period {
  dateFrom: string | null;
  dateTo: string | null;
}

export const ALL_TIME: Period = { dateFrom: null, dateTo: null };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Traduce el valor del selector de período a un rango de fechas concreto.
 * "30d" y "prev-month" no son ventanas de N meses relativas a hoy (a
 * diferencia de "3"/"6"), así que se resuelven aparte con fechas explícitas.
 */
export function resolvePeriod(periodParam: string | undefined): Period {
  const now = new Date();

  if (periodParam === "all" || !periodParam) return ALL_TIME;

  if (periodParam === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { dateFrom: isoDate(from), dateTo: null };
  }

  if (periodParam === "prev-month") {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
    return { dateFrom: isoDate(firstOfPrevMonth), dateTo: isoDate(lastOfPrevMonth) };
  }

  if (periodParam.startsWith("month:")) {
    const match = /^month:(\d{4})-(\d{2})$/.exec(periodParam);
    if (!match) return ALL_TIME;
    const year = Number(match[1]);
    const month = Number(match[2]); // 1-12
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0); // día 0 del mes siguiente = último día de este mes
    return { dateFrom: isoDate(from), dateTo: isoDate(to) };
  }

  const months = Number(periodParam);
  if (!months) return ALL_TIME;
  // Ancla al día 1 del mes calendario, no "hoy menos N meses" — si no, el mes
  // más viejo del rango queda parcial (le faltan los primeros días) sin ningún
  // aviso, y una barra mensual que se ve completa en realidad no lo está.
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { dateFrom: isoDate(from), dateTo: null };
}

function periodClause(period: Period): { clause: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  if (period.dateFrom) {
    conditions.push("date >= ?");
    params.push(period.dateFrom);
  }
  if (period.dateTo) {
    conditions.push("date <= ?");
    params.push(period.dateTo);
  }
  return { clause: conditions.length ? `AND ${conditions.join(" AND ")}` : "", params };
}

export interface CategorySpending {
  name: string;
  total: number;
  /** null para "Sin categoría" y para el bucket sintético "Otros" (agrupa varias categorías, no clickeable) */
  categoryId: number | null;
  /** Solo en el bucket sintético "Otros": el detalle de las categorías que agrupa. */
  breakdown?: CategorySpending[];
}

export function getSpendingByCategory(
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): CategorySpending[] {
  const { clause, params } = periodClause(period);

  let rows: CategorySpending[];
  if (inflationIndex) {
    // Con ajuste por inflación no alcanza con sumar en SQL: cada transacción
    // tiene su propio factor según el mes, así que hay que traer las filas
    // crudas y sumar ya ajustadas en JS.
    const raw = db
      .prepare(
        `
        SELECT COALESCE(c.name, 'Sin categoría') AS name, c.id AS categoryId, t.date AS date, t.amount AS amount
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.impacts_analysis = 'Sí' AND t.amount < 0 ${clause}
      `
      )
      .all(...params) as { name: string; categoryId: number | null; date: string; amount: number }[];

    const totals = new Map<string, { categoryId: number | null; total: number }>();
    for (const row of raw) {
      const factor = getAdjustmentFactor(inflationIndex, row.date.slice(0, 7));
      const current = totals.get(row.name) ?? { categoryId: row.categoryId, total: 0 };
      current.total += Math.abs(row.amount) * factor;
      totals.set(row.name, current);
    }
    rows = [...totals.entries()]
      .map(([name, { categoryId, total }]) => ({ name, categoryId, total }))
      .sort((a, b) => b.total - a.total);
  } else {
    rows = db
      .prepare(
        `
        SELECT COALESCE(c.name, 'Sin categoría') AS name, c.id AS categoryId, SUM(ABS(t.amount)) AS total
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.impacts_analysis = 'Sí' AND t.amount < 0 ${clause}
        GROUP BY name
        ORDER BY total DESC
      `
      )
      .all(...params) as CategorySpending[];
  }

  if (rows.length <= MAX_CATEGORY_SLOTS) return rows;

  const top = rows.slice(0, MAX_CATEGORY_SLOTS);
  const tail = rows.slice(MAX_CATEGORY_SLOTS);
  const otherTotal = tail.reduce((sum, row) => sum + row.total, 0);
  return [...top, { name: "Otros", categoryId: null, total: otherTotal, breakdown: tail }];
}

export interface MonthlyAmount {
  month: string;
  total: number;
}

export function getMonthlySpending(
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): MonthlyAmount[] {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT strftime('%Y-%m', date) AS month, SUM(ABS(amount)) AS total
      FROM transactions
      WHERE impacts_analysis = 'Sí' AND amount < 0 ${clause}
      GROUP BY month
      ORDER BY month ASC
    `
    )
    .all(...params) as MonthlyAmount[];

  // Cada fila ya es un solo mes, así que el factor de ese mes aplica exacto a todo el bucket.
  if (!inflationIndex) return rows;
  return rows.map((row) => ({
    month: row.month,
    total: row.total * getAdjustmentFactor(inflationIndex, row.month),
  }));
}

export function getCategoryMonthlySpending(
  categoryId: number,
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): MonthlyAmount[] {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT strftime('%Y-%m', date) AS month, SUM(ABS(amount)) AS total
      FROM transactions
      WHERE ${categoryScopeClause(categoryId)} ${clause}
      GROUP BY month
      ORDER BY month ASC
    `
    )
    .all(categoryId, ...params) as MonthlyAmount[];

  if (!inflationIndex) return rows;
  return rows.map((row) => ({
    month: row.month,
    total: row.total * getAdjustmentFactor(inflationIndex, row.month),
  }));
}

export interface MonthComparison {
  currentMonth: string;
  currentTotal: number;
  previousMonth: string;
  previousTotal: number;
  deltaPct: number;
}

/**
 * Compara el gasto del mes calendario en curso contra el mes anterior — siempre
 * sobre el historial completo (no el período seleccionado en el selector), porque
 * la comparación tiene que ser contra los últimos dos meses reales.
 */
export function getMonthOverMonthChange(
  categoryId?: number,
  inflationIndex: InflationIndex | null = null
): MonthComparison | null {
  const rows = categoryId
    ? getCategoryMonthlySpending(categoryId, ALL_TIME, inflationIndex)
    : getMonthlySpending(ALL_TIME, inflationIndex);

  if (rows.length < 2) return null;

  const [previous, current] = rows.slice(-2);
  if (previous.total === 0) return null;

  return {
    currentMonth: current.month,
    currentTotal: current.total,
    previousMonth: previous.month,
    previousTotal: previous.total,
    deltaPct: ((current.total - previous.total) / previous.total) * 100,
  };
}

export interface SubcategorySpending {
  name: string;
  total: number;
}

export function getSubcategorySpending(
  categoryId: number,
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): SubcategorySpending[] {
  const { clause, params } = periodClause(period);

  if (inflationIndex) {
    const raw = db
      .prepare(
        `
        SELECT COALESCE(subcategory, 'Sin subcategoría') AS name, date, amount
        FROM transactions
        WHERE ${categoryScopeClause(categoryId)} ${clause}
      `
      )
      .all(categoryId, ...params) as { name: string; date: string; amount: number }[];

    const totals = new Map<string, number>();
    for (const row of raw) {
      const factor = getAdjustmentFactor(inflationIndex, row.date.slice(0, 7));
      totals.set(row.name, (totals.get(row.name) ?? 0) + Math.abs(row.amount) * factor);
    }
    return [...totals.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }

  return db
    .prepare(
      `
      SELECT COALESCE(subcategory, 'Sin subcategoría') AS name, SUM(ABS(amount)) AS total
      FROM transactions
      WHERE ${categoryScopeClause(categoryId)} ${clause}
      GROUP BY name
      ORDER BY total DESC
    `
    )
    .all(categoryId, ...params) as SubcategorySpending[];
}

export interface CategoryMonthlySubcategory {
  month: string;
  [subcategory: string]: number | string;
}

/** Igual que getSubcategorySpending pero desglosado mes a mes, para el gráfico apilado de la pantalla de categoría. */
export function getCategoryMonthlySpendingBySubcategory(
  categoryId: number,
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): { data: CategoryMonthlySubcategory[]; subcategories: string[] } {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT strftime('%Y-%m', date) AS month, COALESCE(subcategory, 'Sin subcategoría') AS subcategory, date, amount
      FROM transactions
      WHERE ${categoryScopeClause(categoryId)} ${clause}
    `
    )
    .all(categoryId, ...params) as { month: string; subcategory: string; date: string; amount: number }[];

  const byMonth = new Map<string, Record<string, number>>();
  const totalsBySubcategory = new Map<string, number>();
  for (const row of rows) {
    const factor = inflationIndex ? getAdjustmentFactor(inflationIndex, row.month) : 1;
    const amount = Math.abs(row.amount) * factor;
    const entry = byMonth.get(row.month) ?? {};
    entry[row.subcategory] = (entry[row.subcategory] ?? 0) + amount;
    byMonth.set(row.month, entry);
    totalsBySubcategory.set(row.subcategory, (totalsBySubcategory.get(row.subcategory) ?? 0) + amount);
  }

  // Ordenadas por tamaño (mayor a menor) en vez de alfabético, para que la
  // leyenda, el apilado y el tooltip al pasar el mouse lean igual que "Por subcategoría".
  const subcategories = [...totalsBySubcategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const data = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, values]) => ({ month, ...values }));

  return { data, subcategories };
}

export interface TopCounterparty {
  name: string;
  total: number;
  count: number;
}

/** Top contrapartes por gasto en el período — equivalente a "Top comercios/personas" del Excel histórico. */
export function getTopCounterparties(
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null,
  limit = 10
): TopCounterparty[] {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT description, date, amount FROM transactions
      WHERE impacts_analysis = 'Sí' AND amount < 0 ${clause}
    `
    )
    .all(...params) as { description: string; date: string; amount: number }[];

  const totals = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const key = extractCounterparty(row.description);
    const factor = inflationIndex ? getAdjustmentFactor(inflationIndex, row.date.slice(0, 7)) : 1;
    const entry = totals.get(key) ?? { total: 0, count: 0 };
    entry.total += Math.abs(row.amount) * factor;
    entry.count += 1;
    totals.set(key, entry);
  }

  return [...totals.entries()]
    .map(([name, { total, count }]) => ({ name, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface ExpenseClassMonthly {
  month: string;
  Fijo: number;
  Variable: number;
  Extraordinario: number;
}

/** Evolución mes a mes de la composición Fijo/Variable/Extraordinario (vs. el total del período de getExpenseClassReport). */
export function getExpenseClassOverTime(
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): ExpenseClassMonthly[] {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT strftime('%Y-%m', date) AS month, expense_class AS expenseClass, amount
      FROM transactions
      WHERE impacts_analysis = 'Sí' AND amount < 0 AND expense_class != 'No aplica' ${clause}
    `
    )
    .all(...params) as { month: string; expenseClass: "Fijo" | "Variable" | "Extraordinario"; amount: number }[];

  const byMonth = new Map<string, ExpenseClassMonthly>();
  for (const row of rows) {
    const factor = inflationIndex ? getAdjustmentFactor(inflationIndex, row.month) : 1;
    const entry = byMonth.get(row.month) ?? { month: row.month, Fijo: 0, Variable: 0, Extraordinario: 0 };
    entry[row.expenseClass] += Math.abs(row.amount) * factor;
    byMonth.set(row.month, entry);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface MonthlyIncomeExpense {
  month: string;
  income: number;
  expense: number;
}

export function getIncomeVsExpense(
  period: Period = ALL_TIME,
  inflationIndex: InflationIndex | null = null
): MonthlyIncomeExpense[] {
  const { clause, params } = periodClause(period);
  const rows = db
    .prepare(
      `
      SELECT
        strftime('%Y-%m', date) AS month,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expense
      FROM transactions
      WHERE impacts_analysis = 'Sí' ${clause}
      GROUP BY month
      ORDER BY month ASC
    `
    )
    .all(...params) as MonthlyIncomeExpense[];

  if (!inflationIndex) return rows;
  return rows.map((row) => {
    const factor = getAdjustmentFactor(inflationIndex, row.month);
    return { month: row.month, income: row.income * factor, expense: row.expense * factor };
  });
}

export interface NetWorthPoint {
  month: string;
  netWorth: number;
}

/** Reconstruye el patrimonio neto mes a mes con "carry-forward": si una cuenta
 * no se actualizó en un mes, se usa su último valor conocido. */
export function getNetWorthOverTime(): NetWorthPoint[] {
  const assetRows = db
    .prepare(
      "SELECT asset_id AS id, strftime('%Y-%m', recorded_at) AS month, value FROM asset_history ORDER BY recorded_at ASC"
    )
    .all() as { id: number; month: string; value: number }[];
  const debtRows = db
    .prepare(
      "SELECT debt_id AS id, strftime('%Y-%m', recorded_at) AS month, value FROM debt_history ORDER BY recorded_at ASC"
    )
    .all() as { id: number; month: string; value: number }[];

  const months = Array.from(
    new Set([...assetRows.map((r) => r.month), ...debtRows.map((r) => r.month)])
  ).sort();

  if (months.length === 0) return [];

  function buildRunningTotals(rows: { id: number; month: string; value: number }[]) {
    const latestById = new Map<number, number>();
    const totalByMonth = new Map<string, number>();
    let rowIndex = 0;
    for (const month of months) {
      while (rowIndex < rows.length && rows[rowIndex].month <= month) {
        latestById.set(rows[rowIndex].id, rows[rowIndex].value);
        rowIndex += 1;
      }
      totalByMonth.set(month, [...latestById.values()].reduce((sum, value) => sum + value, 0));
    }
    return totalByMonth;
  }

  const assetTotals = buildRunningTotals(assetRows);
  const debtTotals = buildRunningTotals(debtRows);

  return months.map((month) => ({
    month,
    netWorth: (assetTotals.get(month) ?? 0) - (debtTotals.get(month) ?? 0),
  }));
}

export interface NetWorthProjectionPoint {
  month: string;
  /** Valor real, tomado de una foto guardada en Patrimonio (asset_history/debt_history). */
  netWorth: number | null;
  /** Estimación hacia atrás para meses sin foto real (ver getNetWorthHistoryWithEstimate). */
  estimatedNetWorth: number | null;
  /** Tendencia lineal simple hacia adelante. */
  projected: number | null;
}

const PROJECTION_MIN_HISTORY_MONTHS = 3;
const PROJECTION_LOOKBACK_MONTHS = 6;
const PROJECTION_MONTHS_AHEAD = 3;

function addMonths(month: string, offset: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface NetWorthHistoryPoint {
  month: string;
  netWorth: number;
  /** true = reconstruido hacia atrás, no una foto real guardada en Patrimonio. */
  estimated: boolean;
}

/**
 * Patrimonio solo guarda una foto real por mes a partir de que Juan actualiza
 * los valores de sus cuentas — si recién empezó a hacerlo, no hay historial
 * previo. Para los meses anteriores a la primera foto real, se reconstruye
 * el patrimonio neto restando hacia atrás el flujo de caja neto (ingresos -
 * gastos reales) mes a mes desde ese primer valor conocido. Es una
 * ESTIMACIÓN: asume que lo que no pasó por una transacción (ej. variación de
 * valor de inversiones, deudas que cambiaron sin un pago registrado) se
 * mantuvo constante — no es tan preciso como una foto real.
 */
export function getNetWorthHistoryWithEstimate(): NetWorthHistoryPoint[] {
  const actual = getNetWorthOverTime();
  if (actual.length === 0) return [];

  const earliestActualMonth = actual[0].month;
  const cashFlow = getIncomeVsExpense();
  const netFlowByMonth = new Map(cashFlow.map((row) => [row.month, row.income - row.expense]));
  const priorMonths = cashFlow
    .map((row) => row.month)
    .filter((month) => month < earliestActualMonth)
    .sort();

  const estimatedPoints: NetWorthHistoryPoint[] = [];
  let runningValue = actual[0].netWorth;
  for (let i = priorMonths.length - 1; i >= 0; i -= 1) {
    const month = priorMonths[i];
    const nextMonth = i + 1 < priorMonths.length ? priorMonths[i + 1] : earliestActualMonth;
    runningValue -= netFlowByMonth.get(nextMonth) ?? 0;
    estimatedPoints.unshift({ month, netWorth: runningValue, estimated: true });
  }

  return [...estimatedPoints, ...actual.map((point) => ({ ...point, estimated: false }))];
}

/**
 * Regresión lineal simple sobre los últimos meses de patrimonio neto (real +
 * estimado), extendida unos meses hacia adelante. Con poco historial la
 * tendencia es poco confiable, por eso no se proyecta hasta tener un mínimo
 * de meses.
 */
export function getNetWorthProjection(): NetWorthProjectionPoint[] {
  const history = getNetWorthHistoryWithEstimate();
  const earliestActualMonth = history.find((point) => !point.estimated)?.month;
  const points: NetWorthProjectionPoint[] = history.map((point) => ({
    month: point.month,
    netWorth: point.estimated ? null : point.netWorth,
    // Duplicar el primer valor real en el último punto estimado para que la
    // línea punteada "hacia atrás" llegue pegada a la sólida, sin salto visual.
    estimatedNetWorth: point.estimated || point.month === earliestActualMonth ? point.netWorth : null,
    projected: null,
  }));

  if (history.length < PROJECTION_MIN_HISTORY_MONTHS) return points;

  const sample = history.slice(-PROJECTION_LOOKBACK_MONTHS);
  const n = sample.length;
  const xs = sample.map((_, i) => i);
  const ys = sample.map((point) => point.netWorth);
  const xMean = xs.reduce((sum, x) => sum + x, 0) / n;
  const yMean = ys.reduce((sum, y) => sum + y, 0) / n;
  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  const lastMonth = history[history.length - 1].month;
  const lastPoint = points[points.length - 1];
  // Duplicar el último punto en "projected" para que la línea punteada hacia
  // adelante arranque pegada a la sólida, sin salto visual en el gráfico.
  const bridge: NetWorthProjectionPoint = { ...lastPoint, projected: lastPoint.netWorth };
  const future: NetWorthProjectionPoint[] = Array.from({ length: PROJECTION_MONTHS_AHEAD }, (_, i) => {
    const x = n - 1 + (i + 1);
    return {
      month: addMonths(lastMonth, i + 1),
      netWorth: null,
      estimatedNetWorth: null,
      projected: intercept + slope * x,
    };
  });

  return [...points.slice(0, -1), bridge, ...future];
}

export interface DistributionItem {
  name: string;
  value: number;
  kind: "asset" | "debt";
}

export function getAssetDebtDistribution(): DistributionItem[] {
  const assets = db
    .prepare("SELECT name, current_value AS value FROM assets WHERE included_in_balance = 1")
    .all() as { name: string; value: number }[];
  const debts = db
    .prepare("SELECT name, current_value AS value FROM debts WHERE included_in_balance = 1")
    .all() as { name: string; value: number }[];

  return [
    ...assets.map((a) => ({ ...a, kind: "asset" as const })),
    ...debts.map((d) => ({ ...d, kind: "debt" as const })),
  ];
}
