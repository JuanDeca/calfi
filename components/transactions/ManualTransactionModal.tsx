"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { ExpenseClass } from "@/types/transaction";
import { CategoryPicker } from "@/components/ui/CategoryPicker";

const EXPENSE_CLASS_OPTIONS: ExpenseClass[] = [
  "Fijo",
  "Variable",
  "Extraordinario",
  "No aplica",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualTransactionButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-border px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-soft"
      >
        ＋ Manual
      </button>
      {open && (
        <ManualTransactionModal
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ManualTransactionModal({
  categories,
  onClose,
  onSaved,
}: {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"gasto" | "ingreso">("gasto");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [expenseClass, setExpenseClass] = useState<ExpenseClass>("Fijo");
  const [impactsAnalysis, setImpactsAnalysis] = useState<"Sí" | "No">("Sí");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!description.trim() || !Number(amount)) {
      setError("Completá descripción y monto.");
      return;
    }
    if (categoryId === "" && impactsAnalysis === "Sí") {
      setError("Elegí una categoría (o marcá que no impacta el análisis).");
      return;
    }

    setSaving(true);
    setError(null);

    const signedAmount = kind === "gasto" ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

    const response = await fetch("/api/transactions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        description: description.trim(),
        amount: signedAmount,
        categoryId: categoryId === "" ? null : categoryId,
        subcategory: subcategory.trim() || null,
        expenseClass,
        impactsAnalysis,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar la transacción.");
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[430px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">Transacción manual</span>
        </div>

        <div className="px-[18px] py-4">
          <div className="mb-3.5 flex gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-control border-[1.5px] border-border px-3 py-2 text-[12.5px] text-ink-muted"
            />
            <div className="flex flex-1 overflow-hidden rounded-control border-[1.5px] border-border text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setKind("gasto")}
                className={`flex-1 py-2 ${kind === "gasto" ? "bg-terracotta-600 text-white" : "text-stone-light"}`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setKind("ingreso")}
                className={`flex-1 py-2 ${kind === "ingreso" ? "bg-sage-600 text-white" : "text-stone-light"}`}
              >
                Ingreso
              </button>
            </div>
          </div>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Descripción
          </label>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej. Tarjeta Visa Banco X — cuota TV"
            className="mb-3.5 w-full rounded-control border-[1.5px] border-border px-3 py-2 text-[12.5px] text-ink-muted"
          />

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">Monto</label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            inputMode="numeric"
            className="mb-3.5 w-full rounded-control border-[1.5px] border-border px-3 py-2 text-right font-mono text-[12.5px] text-ink"
          />

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Categoría{" "}
            {impactsAnalysis === "No" && (
              <span className="font-normal text-stone-faint">
                (opcional — no impacta el análisis)
              </span>
            )}
          </label>
          <div className="mb-3.5">
            <CategoryPicker
              categories={categories}
              value={categoryId}
              emptyLabel={impactsAnalysis === "No" ? "Sin categoría" : "Elegir categoría…"}
              allowEmpty
              className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border px-3 py-2 text-left text-[12.5px] text-ink-muted"
              onChange={(id, category) => {
                setCategoryId(id);
                if (category?.excludedFromAnalysis) setImpactsAnalysis("No");
              }}
            />
          </div>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Subcategoría <span className="font-normal text-stone-faint">(opcional)</span>
          </label>
          <input
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            className="mb-3.5 w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
          />

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Clase de gasto
          </label>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {EXPENSE_CLASS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setExpenseClass(option)}
                className={`rounded-control border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold ${
                  expenseClass === option
                    ? "border-sage-600 bg-sage-100 text-sage-700"
                    : "border-border bg-white text-stone-light"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between rounded-control bg-cream-soft px-3 py-2.5">
            <span className="text-xs font-medium text-ink-muted">¿Impacta el análisis?</span>
            <div className="flex overflow-hidden rounded-md border-[1.5px] border-border text-[10.5px] font-semibold">
              <button
                type="button"
                onClick={() => setImpactsAnalysis("Sí")}
                className={`px-3 py-1 ${
                  impactsAnalysis === "Sí" ? "bg-sage-600 text-white" : "text-stone-light"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setImpactsAnalysis("No")}
                className={`px-3 py-1 ${
                  impactsAnalysis === "No" ? "bg-sage-600 text-white" : "text-stone-light"
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="mb-4 flex gap-2 rounded-control border-[1.5px] border-dashed border-border-dashed bg-cream-soft px-3 py-2.5">
            <span className="text-stone-light">ⓘ</span>
            <span className="text-[11.5px] leading-relaxed text-stone-light">
              Para gastos que no pasan por Mercado Pago (ej. tarjetas de otros bancos). Queda
              marcada como "carga manual" en la tabla, distinta de lo importado.
            </span>
          </div>

          {error && <div className="mb-3 text-[11.5px] text-terracotta-700">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
