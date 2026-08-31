import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Pagination } from "@/components/transactions/Pagination";
import { getTransactions, getTransactionsCount } from "@/lib/transactions";
import { getCategories } from "@/lib/categories";
import { getEvents } from "@/lib/events";

const PAGE_SIZE = 30;

interface DudososSearchParams {
  search?: string;
  categoryId?: string;
  expenseClass?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

export default async function DudososPage({
  searchParams,
}: {
  searchParams: Promise<DudososSearchParams>;
}) {
  const params = await searchParams;
  const filters = {
    search: params.search || undefined,
    categoryId: params.categoryId ? Number(params.categoryId) : undefined,
    expenseClass: params.expenseClass || undefined,
    impactsAnalysis: "Pendiente",
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
  };
  const page = Math.max(1, Number(params.page) || 1);

  const rawTransactions = getTransactions(filters, { page, pageSize: PAGE_SIZE });
  const total = getTransactionsCount(filters);
  const unknownCount = getTransactionsCount({ subcategory: "Desconocidos" });
  const categories = getCategories();
  const events = getEvents();

  const transactions = rawTransactions.map((transaction) => ({
    ...transaction,
    displayAmount: transaction.amount,
  }));

  return (
    <>
      <Topbar title="Dudosos">
        {unknownCount > 0 && (
          <Link
            href="/transacciones?subcategory=Desconocidos"
            title="Ver transacciones categorizadas como Otros/Ingresos → Desconocidos"
            className="rounded-full border-[1.5px] border-dashed border-stone-faint px-2.5 py-1 font-mono text-[10.5px] font-semibold text-stone-light hover:border-amber-border hover:bg-amber-100 hover:text-amber-700"
          >
            ❓ {unknownCount} en Desconocidos
          </Link>
        )}
        <span className="rounded-full border-[1.5px] border-amber-border bg-amber-100 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-amber-700">
          {total} pendientes
        </span>
      </Topbar>
      <TransactionsFilterBar categories={categories} basePath="/dudosos" hideImpactsFilter />
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10 text-sm text-stone">
          No hay movimientos dudosos por revisar. 🎉
        </div>
      ) : (
        <>
          <TransactionsTable
            transactions={transactions}
            currency="ARS"
            categories={categories}
            events={events}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            searchParams={params as Record<string, string | undefined>}
            basePath="/dudosos"
          />
        </>
      )}
    </>
  );
}
