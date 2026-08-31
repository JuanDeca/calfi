import { Topbar } from "@/components/layout/Topbar";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { CategoryPieChart } from "@/components/insights/CategoryPieChart";
import { IncomeExpenseChart } from "@/components/insights/IncomeExpenseChart";
import { NetWorthChart } from "@/components/insights/NetWorthChart";
import { DistributionChart } from "@/components/insights/DistributionChart";
import { MonthOverMonthChip } from "@/components/insights/MonthOverMonthChip";
import { TopCounterpartiesChart } from "@/components/insights/TopCounterpartiesChart";
import { ExpenseClassOverTimeChart } from "@/components/insights/ExpenseClassOverTimeChart";
import { CurrencyToggle } from "@/components/transactions/CurrencyToggle";
import { InflationToggle } from "@/components/transactions/InflationToggle";
import {
  getSpendingByCategory,
  getIncomeVsExpense,
  getNetWorthProjection,
  getAssetDebtDistribution,
  getMonthOverMonthChange,
  getTopCounterparties,
  getExpenseClassOverTime,
  resolvePeriod,
} from "@/lib/insights";
import { getUsdRate } from "@/lib/exchangeRate";
import { getInflationIndex } from "@/lib/inflacion";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; currency?: string; adjustInflation?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params.period ?? "all");

  const [usdRate, inflationIndex] = await Promise.all([getUsdRate(), getInflationIndex()]);

  const showUsd = params.currency === "usd" && usdRate !== null;
  const adjustInflation = params.adjustInflation === "1" && inflationIndex !== null;
  const activeInflationIndex = adjustInflation ? inflationIndex : null;
  const currency = showUsd ? "USD" : "ARS";
  const usdFactor = showUsd && usdRate ? 1 / usdRate.rate : 1;

  const categorySpending = getSpendingByCategory(period, activeInflationIndex).map((row) => ({
    ...row,
    total: row.total * usdFactor,
    breakdown: row.breakdown?.map((entry) => ({ ...entry, total: entry.total * usdFactor })),
  }));
  const incomeVsExpense = getIncomeVsExpense(period, activeInflationIndex).map((row) => ({
    ...row,
    income: row.income * usdFactor,
    expense: row.expense * usdFactor,
  }));
  const netWorthOverTime = getNetWorthProjection();
  const distribution = getAssetDebtDistribution();
  const monthOverMonth = getMonthOverMonthChange(undefined, activeInflationIndex);
  const topCounterparties = getTopCounterparties(period, activeInflationIndex).map((row) => ({
    ...row,
    total: row.total * usdFactor,
  }));
  const expenseClassOverTime = getExpenseClassOverTime(period, activeInflationIndex).map((row) => ({
    ...row,
    Fijo: row.Fijo * usdFactor,
    Variable: row.Variable * usdFactor,
    Extraordinario: row.Extraordinario * usdFactor,
  }));

  return (
    <>
      <Topbar title="Insights">
        <InflationToggle referenceMonth={inflationIndex?.referenceMonth ?? null} basePath="/insights" />
        <CurrencyToggle usdRate={usdRate} basePath="/insights" />
        <PeriodSelector />
      </Topbar>
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <InsightPanel title="Gastos por categoría">
            <CategoryPieChart data={categorySpending} currency={currency} />
          </InsightPanel>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InsightPanel title="Ingresos vs. egresos">
            <div className="mb-2">
              <MonthOverMonthChip comparison={monthOverMonth} />
            </div>
            <IncomeExpenseChart data={incomeVsExpense} currency={currency} />
          </InsightPanel>
          <InsightPanel title="Evolución patrimonio neto">
            <NetWorthChart data={netWorthOverTime} />
            {netWorthOverTime.some((point) => point.estimatedNetWorth !== null) && (
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-stone-faint">
                Tramo punteado (izquierda): estimado hacia atrás a partir del flujo de caja
                mensual — asumiendo que activos/deudas no registrados como transacciones no
                cambiaron. Actualizá los valores de tus cuentas en Patrimonio para reemplazarlo
                por historial real.
              </p>
            )}
            {netWorthOverTime.some((point) => point.projected !== null) && (
              <p className="mt-1 text-[9.5px] text-stone-faint">
                Tramo punteado (derecha): tendencia lineal simple, no una predicción robusta.
              </p>
            )}
          </InsightPanel>
          <InsightPanel title="Distribución activos / deudas">
            <DistributionChart data={distribution} />
          </InsightPanel>
          <InsightPanel title="Top comercios/personas">
            <TopCounterpartiesChart data={topCounterparties} currency={currency} />
          </InsightPanel>
          <InsightPanel title="Clase de gasto en el tiempo">
            <ExpenseClassOverTimeChart data={expenseClassOverTime} currency={currency} />
          </InsightPanel>
        </div>
      </div>
    </>
  );
}
