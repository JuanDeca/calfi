"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/categories";
import type {
  ExpenseClass,
  Transaction,
} from "@/types/transaction";
import { SubcategoryInput } from "@/components/ui/SubcategoryInput";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import type { PreviousCounterpartyTransaction } from "@/lib/categorization";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const EXPENSE_CLASS_OPTIONS: ExpenseClass[] = [
  "Fijo",
  "Variable",
  "Extraordinario",
  "No aplica",
];

interface CategorizationModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSaved: (appliedRetroactively: number) => void;
}

export function CategorizationModal({
  transaction,
  categories,
  onClose,
  onSaved,
}: CategorizationModalProps) {
  const [categoryId, setCategoryId] = useState<number | "">(transaction.categoryId ?? "");
  const [subcategory, setSubcategory] = useState(transaction.subcategory ?? "");
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [impactsAnalysis, setImpactsAnalysis] = useState<"Sí" | "No">(
    transaction.impactsAnalysis === "No" ? "No" : "Sí"
  );
  const [expenseClass, setExpenseClass] = useState<ExpenseClass>(transaction.expenseClass);
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [alreadyCategorizedCount, setAlreadyCategorizedCount] = useState(0);
  const [pendienteCount, setPendienteCount] = useState(0);
  const [previousTransactions, setPreviousTransactions] = useState<PreviousCounterpartyTransaction[]>(
    []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([]);

  const hasUnknownHistory =
    transaction.subcategory !== "Desconocidos" &&
    previousTransactions.some((previous) => previous.subcategory === "Desconocidos");

  useEffect(() => {
    if (categoryId === "") return;
    fetch(`/api/categories/${categoryId}/subcategories`)
      .then((response) => response.json())
      .then((data) => setSubcategoryOptions(data.subcategories ?? []))
      .catch(() => setSubcategoryOptions([]));
  }, [categoryId]);

  useEffect(() => {
    fetch(`/api/transactions/${transaction.id}/categorize`)
      .then((response) => response.json())
      .then((data) => {
        setAlreadyCategorizedCount(data.alreadyCategorizedCount ?? 0);
        setPendienteCount(data.pendienteCount ?? 0);
        setPreviousTransactions(data.previousTransactions ?? []);
      })
      .catch(() => {
        setAlreadyCategorizedCount(0);
        setPendienteCount(0);
        setPreviousTransactions([]);
      });
  }, [transaction.id]);

  async function handleSave() {
    if (categoryId === "" && impactsAnalysis === "Sí") {
      setError("Elegí una categoría (o marcá que no impacta el análisis si no aplica).");
      return;
    }
    setSaving(true);
    setError(null);

    const [response] = await Promise.all([
      fetch(`/api/transactions/${transaction.id}/categorize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: categoryId === "" ? null : categoryId,
          subcategory: subcategory.trim() || null,
          impactsAnalysis,
          expenseClass,
          applyToFuture,
          applyToExisting: applyToFuture && applyToExisting,
        }),
      }),
      fetch(`/api/transactions/${transaction.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      }),
    ]);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar la categorización.");
      setSaving(false);
      return;
    }

    const data = await response.json();
    onSaved(data.appliedRetroactively ?? 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        className={`flex min-w-0 max-w-full flex-col overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card ${
          previousTransactions.length > 0 ? "w-[860px]" : "w-[560px]"
        }`}
        // `html { zoom: 1.3 }` en globals.css hace que los % de vh se perciban
        // ~30% más grandes en pantalla — 65vh acá termina viéndose como ~85vh reales.
        style={{ maxHeight: "65vh" }}
      >
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">Categorización</span>
        </div>

        <div className="flex-1 overflow-y-auto p-[18px]">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[11px] text-stone-light">{transaction.counterparty}</div>
              <div className="mb-3.5 font-mono text-base font-semibold text-ink">
                {formatAmount(Math.abs(transaction.amount))}
              </div>

              {hasUnknownHistory && (
                <div className="mb-3.5 rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 px-3 py-2.5">
                  <span className="text-[11.5px] leading-relaxed text-amber-700">
                    ❓ Esta contraparte ya tiene otra transacción marcada <b>Desconocidos</b> —
                    mirá el historial de la derecha, quizás una te ayude a recordar la otra.
                  </span>
                </div>
              )}

              <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
                Nota personal{" "}
                <span className="font-normal text-stone-faint">
                  (opcional — para acordarte de qué se trataba)
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej: arreglo del auto, cumpleaños de..."
                rows={2}
                className="mb-3.5 w-full resize-none rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
              />

              <div className="mb-3.5 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
                    Categoría{" "}
                    {impactsAnalysis === "No" && (
                      <span className="font-normal text-stone-faint">(opcional)</span>
                    )}
                  </label>
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

                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
                    Subcategoría <span className="font-normal text-stone-faint">(opcional)</span>
                  </label>
                  <SubcategoryInput
                    value={subcategory}
                    onChange={setSubcategory}
                    options={subcategoryOptions}
                    className="w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
                  />
                </div>
              </div>

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

              {applyToFuture && pendienteCount > 0 && (
                <div className="mb-2 rounded-control border-[1.5px] border-dashed border-sage-dash bg-sage-50 px-3 py-2.5">
                  <span className="text-[11.5px] leading-relaxed text-sage-700">
                    💡 Hay <b>{pendienteCount}</b> transacción{pendienteCount === 1 ? "" : "es"}{" "}
                    más de <b>{transaction.counterparty}</b> esperando categorización — al
                    guardar con la opción de recordar tildada, se resuelven junto con esta.
                  </span>
                </div>
              )}

              <label className="mb-2 flex cursor-pointer items-start gap-2 rounded-control border-[1.5px] border-dashed border-sage-dash bg-sage-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={applyToFuture}
                  onChange={(event) => setApplyToFuture(event.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[11.5px] leading-relaxed text-sage-700">
                  Recordar esta categorización para futuras transacciones con{" "}
                  <b>{transaction.counterparty}</b> — crea o actualiza una regla automática y
                  resuelve otras pendientes de la misma contraparte.
                </span>
              </label>

              {applyToFuture && alreadyCategorizedCount > 0 && (
                <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={applyToExisting}
                    onChange={(event) => setApplyToExisting(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[11.5px] leading-relaxed text-amber-700">
                    Aplicar también a las <b>{alreadyCategorizedCount}</b> transacción
                    {alreadyCategorizedCount === 1 ? "" : "es"} ya categorizadas de{" "}
                    <b>{transaction.counterparty}</b> — las recategoriza aunque ya tuvieran otra
                    categoría asignada.
                  </span>
                </label>
              )}
            </div>

            {previousTransactions.length > 0 && (
              <div className="min-w-0 flex-none border-border-dashed pt-4 md:w-[260px] md:border-l-[1.5px] md:border-dashed md:pl-4 md:pt-0">
                <div className="mb-2 text-[11px] font-semibold text-ink-soft">
                  Transacciones anteriores ({previousTransactions.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {previousTransactions.map((previous) => (
                    <div
                      key={previous.id}
                      className={`rounded-control border-[1.5px] px-2.5 py-1.5 ${
                        previous.subcategory === "Desconocidos"
                          ? "border-dashed border-amber-border bg-amber-50"
                          : "border-dashed border-border-dashed bg-cream-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-stone-light">
                          {formatDate(previous.date)}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-ink-muted">
                          {formatAmount(Math.abs(previous.amount))}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] ${
                          previous.subcategory === "Desconocidos" ? "font-semibold text-amber-700" : "text-ink-soft"
                        }`}
                      >
                        {previous.categoryName ?? "Sin categoría"}
                        {previous.subcategory && ` · ${previous.subcategory}`}
                      </div>
                      {previous.notes && (
                        <div className="mt-0.5 text-[10.5px] italic text-stone-faint">
                          {previous.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t-[1.5px] border-dashed border-border-dashed bg-white px-[18px] py-3">
          {error && <div className="mb-2 text-[11.5px] text-terracotta-700">{error}</div>}
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
              {saving ? "Guardando…" : applyToFuture ? "Guardar y recordar" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
