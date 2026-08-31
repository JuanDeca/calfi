import type { Transaction } from "@/types/transaction";
import type { Category } from "@/lib/categories";
import type { Event } from "@/lib/events";
import { TransactionRow, gridForColumns } from "@/components/transactions/TransactionRow";

const BASE_COLUMNS = [
  "FECHA",
  "DESCRIPCIÓN",
  "CONTRAPARTE",
  "MONTO",
  "CATEGORÍA",
  "IMPACTA",
  "CLASE",
  "",
];

export type TransactionWithDisplay = Transaction & { displayAmount: number };

interface TransactionsTableProps {
  transactions: TransactionWithDisplay[];
  currency: "ARS" | "USD";
  categories: Category[];
  events: Event[];
  showSubcategory?: boolean;
}

export function TransactionsTable({
  transactions,
  currency,
  categories,
  events,
  showSubcategory = false,
}: TransactionsTableProps) {
  const columns = showSubcategory
    ? [...BASE_COLUMNS.slice(0, 4), "SUBCATEGORÍA", ...BASE_COLUMNS.slice(4)]
    : BASE_COLUMNS;
  const grid = gridForColumns(showSubcategory);

  return (
    <div className="flex-1 overflow-auto px-1.5">
      <div
        className={`grid ${grid} gap-2 border-b-[1.5px] border-border-dashed px-4 py-2.5 font-mono text-[9.5px] font-semibold tracking-wider text-stone-faint`}
      >
        {columns.map((column, index) => (
          <span key={column || index} className={index === 3 ? "text-right" : ""}>
            {column}
          </span>
        ))}
      </div>
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          currency={currency}
          categories={categories}
          events={events}
          showSubcategory={showSubcategory}
        />
      ))}
    </div>
  );
}
