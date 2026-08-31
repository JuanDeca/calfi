import type { Category } from "@/lib/categories";
import type { Event } from "@/lib/events";
import { CategorizeTrigger } from "@/components/transactions/CategorizeTrigger";
import { ImpactBadge } from "@/components/transactions/badges/ImpactBadge";
import { ExpenseClassPill } from "@/components/transactions/badges/ExpenseClassPill";
import { RowActionsMenu } from "@/components/transactions/RowActionsMenu";
import { formatMoney } from "@/lib/formatMoney";
import type { TransactionWithDisplay } from "@/components/transactions/TransactionsTable";

const TRANSACTIONS_GRID = "grid-cols-[62px_1.6fr_1.1fr_120px_1.05fr_96px_100px_28px]";
const TRANSACTIONS_GRID_WITH_SUBCATEGORY =
  "grid-cols-[62px_1.6fr_1.1fr_120px_0.85fr_1.05fr_96px_100px_28px]";

function gridForColumns(showSubcategory: boolean): string {
  return showSubcategory ? TRANSACTIONS_GRID_WITH_SUBCATEGORY : TRANSACTIONS_GRID;
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

interface TransactionRowProps {
  transaction: TransactionWithDisplay;
  currency: "ARS" | "USD";
  categories: Category[];
  events: Event[];
  showSubcategory?: boolean;
}

export function TransactionRow({
  transaction,
  currency,
  categories,
  events,
  showSubcategory = false,
}: TransactionRowProps) {
  const isIncome = transaction.amount > 0;
  const owedAmount =
    transaction.reimbursementExpected !== null
      ? transaction.reimbursementExpected - transaction.reimbursedSum
      : 0;
  const hasPendingReimbursement = transaction.reimbursementExpected !== null && owedAmount > 0.5;

  return (
    <CategorizeTrigger
      transaction={transaction}
      categories={categories}
      className={`grid ${gridForColumns(showSubcategory)} cursor-pointer items-center gap-2 border-b border-hairline px-4 py-2.5 hover:bg-cream-soft`}
    >
      <span className="font-mono text-[11px] text-stone-light">
        {formatDate(transaction.date)}
      </span>
      <span className="text-[12.5px] font-medium text-ink">
        {transaction.description}
        {transaction.sourceFile === "Carga manual" && (
          <span
            title="Cargada a mano, no viene de un resumen de Mercado Pago"
            className="ml-1.5 rounded-full border border-dashed border-stone-faint px-1.5 py-0.5 align-middle text-[8.5px] font-semibold text-stone-faint"
          >
            manual
          </span>
        )}
        {transaction.notes && (
          <span title={transaction.notes} className="ml-1.5 align-middle text-[11px]">
            📝
          </span>
        )}
        {transaction.hasUnknownHistory && (
          <span
            title="Esta contraparte ya tiene otra transacción marcada como Desconocidos — quizás una te ayude a recordar la otra"
            className="ml-1.5 align-middle text-[11px]"
          >
            ❓
          </span>
        )}
      </span>
      <span className="text-xs text-ink-soft">{transaction.counterparty}</span>
      <span className="relative text-right font-mono text-[12.5px] font-semibold">
        {hasPendingReimbursement && (
          <span
            title={`Te deben $${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(owedAmount)} de reintegro`}
            className="absolute -left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-terracotta-600"
          >
            ⚠
          </span>
        )}
        <span className={isIncome ? "text-sage-700" : "text-ink"}>
          {formatMoney(transaction.displayAmount, currency)}
        </span>
      </span>
      {showSubcategory && (
        <span className="text-xs text-stone-light">{transaction.subcategory ?? "—"}</span>
      )}
      <span className="text-xs text-ink-soft">
        {transaction.categoryName ?? (transaction.hasSplitChildren ? "Desglosado" : "A revisar")}
      </span>
      <ImpactBadge value={transaction.impactsAnalysis} />
      <ExpenseClassPill value={transaction.expenseClass} />
      <RowActionsMenu transaction={transaction} categories={categories} events={events} />
    </CategorizeTrigger>
  );
}

export { TRANSACTIONS_GRID, gridForColumns };
