"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryBudget } from "@/lib/budgets";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

export function BudgetBar({
  categoryId,
  budget,
  spentThisMonth,
}: {
  categoryId: number;
  budget: CategoryBudget | null;
  spentThisMonth: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(String(budget?.monthlyLimit ?? ""));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!Number(limit)) return;
    setSaving(true);
    await fetch(`/api/categories/${categoryId}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: Number(limit) }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleRemove() {
    await fetch(`/api/categories/${categoryId}/budget`, { method: "DELETE" });
    router.refresh();
  }

  if (!budget && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mb-4 rounded-control border-[1.5px] border-dashed border-sage-dash px-3 py-1.5 text-[11px] font-semibold text-sage-600"
      >
        ＋ Definir presupuesto mensual
      </button>
    );
  }

  if (editing) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-control border-[1.5px] border-dashed border-sage-dash bg-sage-50 px-3 py-2.5">
        <span className="text-[11px] font-semibold text-sage-700">Presupuesto mensual:</span>
        <input
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          inputMode="numeric"
          className="w-[120px] rounded-control border-[1.5px] border-border px-2 py-1 text-right font-mono text-xs text-ink"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-control bg-sage-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[11px] text-stone-light"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (!budget) return null;

  const pct = Math.min(100, (spentThisMonth / budget.monthlyLimit) * 100);
  const over = spentThisMonth > budget.monthlyLimit;

  return (
    <div className="mb-4 rounded-control border-[1.5px] border-border-dashed px-3.5 py-3">
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-ink-soft">
          Gastado este mes: <b className={over ? "text-terracotta-700" : "text-ink"}>${formatAmount(spentThisMonth)}</b>{" "}
          de ${formatAmount(budget.monthlyLimit)}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-stone-faint hover:text-ink-soft">
            editar
          </button>
          <button type="button" onClick={handleRemove} className="text-stone-faint hover:text-terracotta-700">
            quitar
          </button>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded bg-hairline">
        <div
          className={`h-full rounded ${over ? "bg-terracotta-600" : "bg-sage-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
