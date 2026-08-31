"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { Event } from "@/lib/events";
import type { Transaction } from "@/types/transaction";
import { SplitModal } from "@/components/transactions/SplitModal";
import { EventAssignModal } from "@/components/transactions/EventAssignModal";
import { ReimburseLinkModal } from "@/components/transactions/ReimburseLinkModal";
import { ReimbursementsModal } from "@/components/transactions/ReimbursementsModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function RowActionsMenu({
  transaction,
  categories,
  events,
}: {
  transaction: Transaction;
  categories: Category[];
  events: Event[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"split" | "event" | "reimburse-link" | "reimbursements" | null>(
    null
  );
  const router = useRouter();
  const confirm = useConfirm();

  const isSplitChild = transaction.parentTransactionId !== null;
  const isIncome = transaction.amount > 0;
  const isManual = transaction.sourceFile === "Carga manual";

  async function handleDelete() {
    if (
      !(await confirm({
        description: `¿Eliminar "${transaction.description}"? Esta acción no se puede deshacer.`,
        danger: true,
      }))
    ) {
      return;
    }
    setMenuOpen(false);
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error ?? "No se pudo eliminar la transacción.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="px-1.5 text-sm text-stone-faint hover:text-ink-soft"
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-control border-[1.5px] border-border bg-white shadow-card">
            {!isSplitChild && (
              <button
                type="button"
                onClick={() => {
                  setModal("split");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink-soft hover:bg-cream-soft"
              >
                {transaction.hasSplitChildren ? "Editar desglose" : "Desglosar"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setModal("event");
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-ink-soft hover:bg-cream-soft"
            >
              Asignar a evento
            </button>
            {isIncome ? (
              <button
                type="button"
                onClick={() => {
                  setModal("reimburse-link");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink-soft hover:bg-cream-soft"
              >
                {transaction.reimbursesTransactionId ? "Vínculo de reintegro" : "Vincular a gasto"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setModal("reimbursements");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink-soft hover:bg-cream-soft"
              >
                Reintegros
              </button>
            )}
            {isManual && (
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full border-t border-hairline px-3 py-2 text-left text-xs text-terracotta-700 hover:bg-terracotta-100/50"
              >
                Eliminar
              </button>
            )}
          </div>
        </>
      )}

      {modal === "split" && (
        <SplitModal
          transaction={transaction}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "event" && (
        <EventAssignModal
          transaction={transaction}
          events={events}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "reimburse-link" && (
        <ReimburseLinkModal
          transaction={transaction}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "reimbursements" && (
        <ReimbursementsModal
          transaction={transaction}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
