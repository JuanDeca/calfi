"use client";

import { useRouter } from "next/navigation";
import type { Transaction } from "@/types/transaction";

function formatAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
    Math.abs(amount)
  );
  return amount < 0 ? `– $${formatted}` : `$${formatted}`;
}

export function EventDetailList({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();

  async function handleRemove(id: number) {
    await fetch(`/api/transactions/${id}/event`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: null }),
    });
    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-stone">
        Todavía no hay movimientos asignados a este evento.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-1.5">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="grid grid-cols-[1fr_120px_80px] items-center gap-2 border-b border-hairline px-4 py-2.5"
        >
          <div>
            <div className="text-[12.5px] font-medium text-ink">{transaction.description}</div>
            <div className="text-[10.5px] text-stone-light">{transaction.date}</div>
          </div>
          <span className="text-right font-mono text-xs font-semibold text-ink">
            {formatAmount(transaction.amount)}
          </span>
          <button
            type="button"
            onClick={() => handleRemove(transaction.id)}
            className="text-right text-[11px] text-stone-faint hover:text-terracotta-700"
          >
            Quitar
          </button>
        </div>
      ))}
    </div>
  );
}
