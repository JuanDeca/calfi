import { Topbar } from "@/components/layout/Topbar";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Pagination } from "@/components/transactions/Pagination";
import { ImportButton } from "@/components/transactions/ImportButton";
import { ManualTransactionButton } from "@/components/transactions/ManualTransactionModal";
import { CurrencyToggle } from "@/components/transactions/CurrencyToggle";
import { InflationToggle } from "@/components/transactions/InflationToggle";
import { getTransactions, getTransactionsCount, getPendingReimbursementsCount } from "@/lib/transactions";
import { getCategories } from "@/lib/categories";
import { getEvents } from "@/lib/events";
import { getUsdRate } from "@/lib/exchangeRate";
import { getInflationIndex, getAdjustmentFactor } from "@/lib/inflacion";

const PAGE_SIZE = 30;

interface TransaccionesSearchParams {
  search?: string;
  categoryId?: string;
  subcategory?: string;
  expenseClass?: string;
  impactsAnalysis?: string;
  dateFrom?: string;
  dateTo?: string;
  currency?: string;
  adjustInflation?: string;
  page?: string;
}

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<TransaccionesSearchParams>;
}) {
  const params = await searchParams;
  const filters = {
    search: params.search || undefined,
    categoryId: params.categoryId ? Number(params.categoryId) : undefined,
    subcategory: params.subcategory || undefined,
    expenseClass: params.expenseClass || undefined,
    impactsAnalysis: params.impactsAnalysis || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
  };
  const page = Math.max(1, Number(params.page) || 1);

  const rawTransactions = getTransactions(filters, { page, pageSize: PAGE_SIZE });
  const total = getTransactionsCount(filters);
  const categories = getCategories();
  const events = getEvents();
  const pendingReimbursements = getPendingReimbursementsCount();

  const [usdRate, inflationIndex] = await Promise.all([getUsdRate(), getInflationIndex()]);

  const showUsd = params.currency === "usd" && usdRate !== null;
  const adjustInflation = params.adjustInflation === "1" && inflationIndex !== null;

  const transactions = rawTransactions.map((transaction) => {
    let displayAmount = transaction.amount;
    if (adjustInflation && inflationIndex) {
      displayAmount *= getAdjustmentFactor(inflationIndex, transaction.date.slice(0, 7));
    }
    if (showUsd && usdRate) {
      displayAmount /= usdRate.rate;
    }
    return { ...transaction, displayAmount };
  });

  return (
    <>
      <Topbar title="Transacciones">
        {pendingReimbursements > 0 && (
          <span
            title="Gastos con reintegros que todavía no suman el total esperado"
            className="rounded-full border-[1.5px] border-terracotta-600 bg-terracotta-100 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-terracotta-700"
          >
            ⚠ {pendingReimbursements} te deben plata
          </span>
        )}
        <InflationToggle referenceMonth={inflationIndex?.referenceMonth ?? null} />
        <CurrencyToggle usdRate={usdRate} />
        <ManualTransactionButton categories={categories} />
        <ImportButton />
      </Topbar>
      <TransactionsFilterBar categories={categories} />
      <TransactionsTable
        transactions={transactions}
        currency={showUsd ? "USD" : "ARS"}
        categories={categories}
        events={events}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        searchParams={params as Record<string, string | undefined>}
      />
    </>
  );
}
