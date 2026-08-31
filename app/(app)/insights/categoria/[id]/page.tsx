import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { CategoryMonthlyStackedChart } from "@/components/insights/CategoryMonthlyStackedChart";
import { SubcategoryBarChart } from "@/components/insights/SubcategoryBarChart";
import { CurrencyToggle } from "@/components/transactions/CurrencyToggle";
import { InflationToggle } from "@/components/transactions/InflationToggle";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { Pagination } from "@/components/transactions/Pagination";
import { MergeSubcategoryForm } from "@/components/insights/MergeSubcategoryForm";
import { BudgetBar } from "@/components/insights/BudgetBar";
import { MonthOverMonthChip } from "@/components/insights/MonthOverMonthChip";
import {
  getCategoryMonthlySpending,
  getCategoryMonthlySpendingBySubcategory,
  getSubcategorySpending,
  getMonthOverMonthChange,
  resolvePeriod,
  type CategoryMonthlySubcategory,
} from "@/lib/insights";
import {
  getCategoryById,
  getCategories,
  getSubcategoriesForCategory,
  getCategorizationRules,
} from "@/lib/categories";
import { getBudgetForCategory, getCurrentMonthSpendingForCategory } from "@/lib/budgets";
import { getEvents } from "@/lib/events";
import { getTransactions, getTransactionsCount } from "@/lib/transactions";
import { getUsdRate } from "@/lib/exchangeRate";
import { getInflationIndex, getAdjustmentFactor } from "@/lib/inflacion";
import { formatMoney } from "@/lib/formatMoney";

const PAGE_SIZE = 30;

export default async function CategoryInsightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    period?: string;
    currency?: string;
    adjustInflation?: string;
    page?: string;
    from?: string;
    search?: string;
    subcategory?: string;
    expenseClass?: string;
    impactsAnalysis?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const { id } = await params;
  const categoryId = Number(id);
  const category = getCategoryById(categoryId);
  if (!category) notFound();

  const sp = await searchParams;
  const period = resolvePeriod(sp.period ?? "all");
  const page = Math.max(1, Number(sp.page) || 1);
  const basePath = `/insights/categoria/${categoryId}`;

  const BACK_LINKS: Record<string, { href: string; label: string }> = {
    categorias: { href: "/categorias", label: "Categorías" },
    auditoria: { href: "/auditoria", label: "Auditoría" },
    insights: { href: "/insights", label: "Insights" },
  };
  const backLink = BACK_LINKS[sp.from ?? "insights"] ?? BACK_LINKS.insights;

  const [usdRate, inflationIndex] = await Promise.all([getUsdRate(), getInflationIndex()]);
  const showUsd = sp.currency === "usd" && usdRate !== null;
  const adjustInflation = sp.adjustInflation === "1" && inflationIndex !== null;
  const activeInflationIndex = adjustInflation ? inflationIndex : null;
  const currency = showUsd ? "USD" : "ARS";
  const usdFactor = showUsd && usdRate ? 1 / usdRate.rate : 1;

  const monthlySpending = getCategoryMonthlySpending(categoryId, period, activeInflationIndex).map(
    (row) => ({ ...row, total: row.total * usdFactor })
  );
  const subcategorySpending = getSubcategorySpending(categoryId, period, activeInflationIndex).map(
    (row) => ({ ...row, total: row.total * usdFactor })
  );
  const total = monthlySpending.reduce((sum, row) => sum + row.total, 0);

  const monthlyBySubcategory = getCategoryMonthlySpendingBySubcategory(
    categoryId,
    period,
    activeInflationIndex
  );
  const stackedChartData: CategoryMonthlySubcategory[] = monthlyBySubcategory.data.map((row) => {
    const adjusted: CategoryMonthlySubcategory = { month: row.month };
    for (const name of monthlyBySubcategory.subcategories) {
      adjusted[name] = (Number(row[name]) || 0) * usdFactor;
    }
    return adjusted;
  });

  const filters = {
    categoryId,
    search: sp.search || undefined,
    subcategory: sp.subcategory || undefined,
    expenseClass: sp.expenseClass || undefined,
    impactsAnalysis: sp.impactsAnalysis || undefined,
    // Un click en una barra del gráfico setea dateFrom/dateTo a un mes puntual,
    // que gana sobre el rango del selector de período (más específico).
    dateFrom: sp.dateFrom || period.dateFrom || undefined,
    dateTo: sp.dateTo || period.dateTo || undefined,
  };
  const rawTransactions = getTransactions(filters, { page, pageSize: PAGE_SIZE });
  const transactionsTotal = getTransactionsCount(filters);
  const categories = getCategories();
  const events = getEvents();
  const subcategories = getSubcategoriesForCategory(categoryId);
  const ruleCount = getCategorizationRules().filter((rule) => rule.categoryId === categoryId).length;
  const budget = getBudgetForCategory(categoryId);
  const spentThisMonth = getCurrentMonthSpendingForCategory(categoryId);
  const monthOverMonth = getMonthOverMonthChange(categoryId, activeInflationIndex);

  const transactions = rawTransactions.map((transaction) => {
    let displayAmount = transaction.amount;
    if (activeInflationIndex) {
      displayAmount *= getAdjustmentFactor(activeInflationIndex, transaction.date.slice(0, 7));
    }
    if (showUsd && usdRate) {
      displayAmount /= usdRate.rate;
    }
    return { ...transaction, displayAmount };
  });

  return (
    <>
      <Breadcrumb items={[backLink]} />
      <Topbar title={category.name}>
        <InflationToggle referenceMonth={inflationIndex?.referenceMonth ?? null} basePath={basePath} />
        <CurrencyToggle usdRate={usdRate} basePath={basePath} />
        <PeriodSelector basePath={basePath} />
        <Link
          href={`/reglas?categoryId=${categoryId}`}
          className="rounded-control border-[1.5px] border-border px-3 py-1.5 text-[11.5px] font-semibold text-ink-muted"
        >
          Ver reglas{ruleCount > 0 ? ` (${ruleCount})` : ""}
        </Link>
      </Topbar>
      <div className="flex-1 overflow-auto p-4">
        <BudgetBar categoryId={categoryId} budget={budget} spentThisMonth={spentThisMonth} />
        <div className="mb-4 flex flex-wrap gap-3.5">
          <div className="min-w-[190px] flex-[1.4] rounded-control border-[1.5px] border-sage-border bg-sage-100 p-4">
            <div className="font-mono text-[10px] font-semibold text-sage-600">
              TOTAL EN EL PERÍODO
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink">
              {formatMoney(total, currency)}
            </div>
            <div className="mt-1.5">
              <MonthOverMonthChip comparison={monthOverMonth} />
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <InsightPanel title="Evolución mensual">
            <CategoryMonthlyStackedChart
              data={stackedChartData}
              subcategories={monthlyBySubcategory.subcategories}
              currency={currency}
              basePath={basePath}
            />
          </InsightPanel>
          <InsightPanel title="Por subcategoría">
            <SubcategoryBarChart data={subcategorySpending} currency={currency} />
            <MergeSubcategoryForm categoryId={categoryId} subcategories={subcategories} />
          </InsightPanel>
        </div>

        <div className="mb-2 text-[11px] font-semibold text-ink-soft">Movimientos</div>
        <div className="rounded-control border-[1.5px] border-border-dashed">
          <TransactionsFilterBar
            categories={categories}
            basePath={basePath}
            hideCategoryFilter
            subcategories={subcategories}
          />
          <TransactionsTable
            transactions={transactions}
            currency={currency}
            categories={categories}
            events={events}
            showSubcategory
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={transactionsTotal}
            searchParams={sp as Record<string, string | undefined>}
            basePath={basePath}
          />
        </div>
      </div>
    </>
  );
}
