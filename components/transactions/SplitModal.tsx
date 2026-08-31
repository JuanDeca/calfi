"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/categories";
import type { ExpenseClass, Transaction } from "@/types/transaction";
import type { SplitTemplatePart } from "@/lib/transactions";
import { SubcategoryInput } from "@/components/ui/SubcategoryInput";
import { CategoryPicker } from "@/components/ui/CategoryPicker";

interface Part {
  categoryId: number | "";
  subcategory: string;
  amount: string;
  expenseClass: ExpenseClass;
}

const EMPTY_PART: Part = { categoryId: "", subcategory: "", amount: "", expenseClass: "Variable" };

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

interface SplitModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function SplitModal({ transaction, categories, onClose, onSaved }: SplitModalProps) {
  const [parts, setParts] = useState<Part[]>([{ ...EMPTY_PART }, { ...EMPTY_PART }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<{ parentDate: string; parts: SplitTemplatePart[] } | null>(
    null
  );
  const [templateApplied, setTemplateApplied] = useState(false);
  const [isEditing, setIsEditing] = useState(transaction.hasSplitChildren);
  const [loadingExisting, setLoadingExisting] = useState(transaction.hasSplitChildren);
  const [subcategoryOptionsByCategory, setSubcategoryOptionsByCategory] = useState<
    Record<number, string[]>
  >({});

  useEffect(() => {
    if (!transaction.hasSplitChildren) return;
    fetch(`/api/transactions/${transaction.id}/split`)
      .then((response) => response.json())
      .then((data) => {
        const children = (data.children ?? []) as SplitTemplatePart[];
        if (children.length > 0) {
          setIsEditing(true);
          setParts(
            children.map((part) => ({
              categoryId: part.categoryId ?? "",
              subcategory: part.subcategory ?? "",
              amount: String(part.amount),
              expenseClass: part.expenseClass,
            }))
          );
        }
        setLoadingExisting(false);
      })
      .catch(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (transaction.hasSplitChildren) return;
    fetch(`/api/transactions/${transaction.id}/split-template`)
      .then((response) => response.json())
      .then((data) => setTemplate(data.template ?? null))
      .catch(() => setTemplate(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const missing = Array.from(
      new Set(parts.map((part) => part.categoryId).filter((id): id is number => id !== ""))
    ).filter((id) => !(id in subcategoryOptionsByCategory));

    missing.forEach((categoryId) => {
      fetch(`/api/categories/${categoryId}/subcategories`)
        .then((response) => response.json())
        .then((data) =>
          setSubcategoryOptionsByCategory((current) => ({
            ...current,
            [categoryId]: data.subcategories ?? [],
          }))
        )
        .catch(() =>
          setSubcategoryOptionsByCategory((current) => ({ ...current, [categoryId]: [] }))
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts]);

  function applyTemplate() {
    if (!template) return;
    setParts(
      template.parts.map((part) => ({
        categoryId: part.categoryId ?? "",
        subcategory: part.subcategory ?? "",
        amount: String(part.amount),
        expenseClass: part.expenseClass,
      }))
    );
    setTemplateApplied(true);
  }

  const total = Math.abs(transaction.amount);
  const assigned = parts.reduce((sum, part) => sum + (Number(part.amount) || 0), 0);
  const remaining = total - assigned;

  function updatePart(index: number, patch: Partial<Part>) {
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  function removePart(index: number) {
    setParts((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const invalid = parts.some((part) => part.categoryId === "" || !Number(part.amount));
    if (invalid) {
      setError("Cada parte necesita categoría y monto.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/transactions/${transaction.id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: parts.map((part) => ({
          categoryId: part.categoryId,
          subcategory: part.subcategory.trim() || null,
          amount: Number(part.amount),
          expenseClass: part.expenseClass,
        })),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar el desglose.");
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[470px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">
            {isEditing ? "Editar desglose" : "Desglose de movimiento"}
          </span>
        </div>

        <div className="px-[18px] py-4">
          <div className="mb-4 flex items-center justify-between rounded-control bg-cream-soft px-3.5 py-3">
            <div>
              <div className="text-[10.5px] text-stone-light">Movimiento original</div>
              <div className="text-[13px] font-semibold text-ink">{transaction.description}</div>
            </div>
            <div className="font-mono text-[15px] font-bold text-ink">
              {transaction.amount < 0 ? "– " : ""}${formatAmount(total)}
            </div>
          </div>

          {loadingExisting && (
            <div className="mb-3 text-[11px] text-stone-faint">Cargando desglose existente…</div>
          )}

          {!isEditing && template && !templateApplied && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-control border-[1.5px] border-dashed border-sage-dash bg-sage-50 px-3 py-2.5">
              <span className="text-[11px] leading-relaxed text-sage-700">
                Encontré un desglose anterior de la misma contraparte ({formatDate(template.parentDate)},{" "}
                {template.parts.length} partes). ¿Usarlo como base?
              </span>
              <button
                type="button"
                onClick={applyTemplate}
                className="flex-none rounded-control border-[1.5px] border-sage-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sage-700"
              >
                Usar
              </button>
            </div>
          )}

          <div className="mb-2 text-[10.5px] font-semibold text-ink-soft">Dividir en partes</div>
          {parts.map((part, index) => (
            <div
              key={index}
              className="mb-2 rounded-control border border-dashed border-border-dashed p-2"
            >
              <div className="grid grid-cols-[1.4fr_1fr_118px_24px] gap-2">
                <div className="min-w-0">
                  <CategoryPicker
                    categories={categories}
                    value={part.categoryId}
                    emptyLabel="Categoría…"
                    className="flex w-full min-w-0 items-center gap-1 rounded-control border-[1.5px] border-border px-2 py-2 text-left text-xs text-ink-muted"
                    onChange={(id) => updatePart(index, { categoryId: id })}
                  />
                </div>
                <select
                  value={part.expenseClass}
                  onChange={(event) =>
                    updatePart(index, { expenseClass: event.target.value as ExpenseClass })
                  }
                  className="min-w-0 rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
                >
                  <option value="Fijo">Fijo</option>
                  <option value="Variable">Variable</option>
                  <option value="Extraordinario">Extraordinario</option>
                  <option value="No aplica">No aplica</option>
                </select>
                <input
                  value={part.amount}
                  onChange={(event) => updatePart(index, { amount: event.target.value })}
                  placeholder="Monto"
                  inputMode="numeric"
                  className="rounded-control border-[1.5px] border-border px-2 py-2 text-right font-mono text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={() => removePart(index)}
                  className="text-center text-[15px] text-stone-faint"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1.5">
                <SubcategoryInput
                  value={part.subcategory}
                  onChange={(value) => updatePart(index, { subcategory: value })}
                  options={part.categoryId === "" ? [] : subcategoryOptionsByCategory[part.categoryId] ?? []}
                  placeholder="Subcategoría (opcional)…"
                  className="w-full rounded-control border-[1.5px] border-dashed border-border px-2 py-1.5 text-xs text-ink-muted"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setParts((current) => [...current, { ...EMPTY_PART }])}
            className="my-1 inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-dashed border-sage-dash px-3 py-1.5 text-[11px] font-semibold text-sage-600"
          >
            ＋ Agregar parte
          </button>

          <div className="mt-3 flex items-center justify-between border-t-[1.5px] border-dashed border-border-dashed py-3">
            <span className="text-xs text-ink-soft">
              Asignado <b className="text-sage-700">${formatAmount(assigned)}</b> · Restante
            </span>
            <span className="font-mono text-sm font-bold text-sage-600">
              ${formatAmount(remaining)}
            </span>
          </div>

          {error && <div className="mb-2 text-[11.5px] text-terracotta-700">{error}</div>}

          <div className="mt-2 flex gap-2">
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
              {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Guardar desglose"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
