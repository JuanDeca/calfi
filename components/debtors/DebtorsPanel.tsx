"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Debtor } from "@/lib/debtors";
import { useConfirm } from "@/components/ui/ConfirmProvider";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

function DebtorCard({ debtor }: { debtor: Debtor }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);

  const pendingTotal = debtor.debts
    .filter((debt) => debt.status === "Pendiente")
    .reduce((sum, debt) => sum + debt.amount, 0);

  async function handleAddDebt() {
    if (!concept.trim() || !Number(amount)) return;
    setCreating(true);
    await fetch(`/api/debtors/${debtor.id}/debts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: concept.trim(), amount: Number(amount) }),
    });
    setConcept("");
    setAmount("");
    setCreating(false);
    router.refresh();
  }

  async function handleToggleStatus(debtId: number, currentStatus: "Pendiente" | "Pagado") {
    await fetch(`/api/debtor-debts/${debtId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: currentStatus === "Pendiente" ? "Pagado" : "Pendiente" }),
    });
    router.refresh();
  }

  async function handleDeleteDebt(debtId: number) {
    await fetch(`/api/debtor-debts/${debtId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDeleteDebtor() {
    if (
      !(await confirm({
        description: `¿Eliminar a "${debtor.name}"? Se borran también todas sus deudas registradas.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/debtors/${debtor.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-control border-[1.5px] border-border-dashed p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-ink">{debtor.name}</div>
          {debtor.notes && <div className="text-[10.5px] text-stone-faint">{debtor.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          {pendingTotal > 0 && (
            <span className="rounded-control bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700">
              Debe ${formatAmount(pendingTotal)}
            </span>
          )}
          <button
            type="button"
            onClick={handleDeleteDebtor}
            className="text-xs text-stone-faint hover:text-terracotta-700"
            title="Eliminar deudor"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {debtor.debts.map((debt) => (
          <div
            key={debt.id}
            className={`flex items-center gap-2 rounded-control border px-2.5 py-1.5 ${
              debt.status === "Pagado" ? "border-dashed border-stone-faint opacity-60" : "border-hairline"
            }`}
          >
            <span className="flex-1 text-xs text-ink">{debt.concept}</span>
            <span className="font-mono text-xs font-semibold text-ink-muted">
              ${formatAmount(debt.amount)}
            </span>
            <button
              type="button"
              onClick={() => handleToggleStatus(debt.id, debt.status)}
              className={`rounded-full border-[1.5px] px-2 py-0.5 text-[9.5px] font-semibold ${
                debt.status === "Pagado"
                  ? "border-sage-border bg-sage-100 text-sage-700"
                  : "border-amber-border bg-amber-100 text-amber-700"
              }`}
            >
              {debt.status}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteDebt(debt.id)}
              className="text-xs text-stone-faint hover:text-terracotta-700"
              title="Eliminar deuda"
            >
              ✕
            </button>
          </div>
        ))}
        {debtor.debts.length === 0 && (
          <div className="py-2 text-center text-[11px] text-stone-faint">
            Sin deudas registradas todavía.
          </div>
        )}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <input
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          placeholder="Concepto…"
          className="flex-1 rounded-control border-[1.5px] border-border px-2.5 py-1.5 text-xs text-ink-muted"
        />
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Monto"
          inputMode="numeric"
          className="w-[110px] rounded-control border-[1.5px] border-border px-2.5 py-1.5 text-right font-mono text-xs text-ink-muted"
        />
        <button
          type="button"
          onClick={handleAddDebt}
          disabled={creating}
          className="rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          ＋
        </button>
      </div>
    </div>
  );
}

export function DebtorsPanel({ debtors }: { debtors: Debtor[] }) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateDebtor() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/debtors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }),
    });
    setName("");
    setNotes("");
    setCreating(false);
    setShowCreateModal(false);
    router.refresh();
  }

  const totalPending = debtors.reduce(
    (sum, debtor) =>
      sum + debtor.debts.filter((debt) => debt.status === "Pendiente").reduce((s, d) => s + d.amount, 0),
    0
  );

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="self-start rounded-control border-[1.5px] border-sage-border bg-sage-100 p-3.5">
        <div className="font-mono text-[10px] font-semibold text-sage-600">
          TOTAL QUE TE DEBEN (PENDIENTE)
        </div>
        <div className="mt-1 font-mono text-2xl font-bold text-ink">${formatAmount(totalPending)}</div>
        <div className="mt-1 text-[10.5px] text-sage-700">
          Registro informativo — no afecta el cálculo de patrimonio neto.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="self-start rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white"
      >
        ＋ Nuevo deudor
      </button>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[380px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">Nuevo deudor</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre del deudor…"
                autoFocus
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Nota (opcional)…"
                className="rounded-control border-[1.5px] border-dashed border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateDebtor}
                  disabled={creating}
                  className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {creating ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {debtors.map((debtor) => (
          <DebtorCard key={debtor.id} debtor={debtor} />
        ))}
        {debtors.length === 0 && (
          <div className="py-6 text-center text-xs text-stone-faint">
            Todavía no cargaste ningún deudor.
          </div>
        )}
      </div>
    </div>
  );
}
