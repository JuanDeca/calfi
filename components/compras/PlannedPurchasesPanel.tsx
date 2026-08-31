"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { PlannedPurchase } from "@/lib/plannedPurchases";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { SAGE, AMBER, TERRACOTTA } from "@/components/insights/chartColors";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatTargetMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split("-");
  // Sin "-": solo se eligió año, sin mes específico.
  if (!month) return year;
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}

function formatPurchasedDate(purchasedAt: string): string {
  const [year, month, day] = purchasedAt.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function daysSince(createdAt: string, now: number): number {
  // SQLite guarda "YYYY-MM-DD HH:MM:SS" (UTC) — Safari/algunos motores no
  // parsean ese formato con Date() directo, por eso el reemplazo a ISO.
  // `now` viaja como prop fijo desde el server (ver ComprasPage) — nunca se
  // calcula con Date.now() directo acá, porque server y cliente podrían
  // calcularlo en instantes levemente distintos y romper la hidratación.
  const created = new Date(createdAt.replace(" ", "T") + "Z");
  const diffMs = now - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Interpola sage → amber → terracotta según `ratio` (0 = mejor/más verde, 1 = peor/más rojo). */
function statusGradient(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  const [start, end] = clamped <= 0.5 ? [SAGE, AMBER] : [AMBER, TERRACOTTA];
  const localT = clamped <= 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const [r1, g1, b1] = hexToRgb(start);
  const [r2, g2, b2] = hexToRgb(end);
  return `rgb(${lerp(r1, r2, localT)}, ${lerp(g1, g2, localT)}, ${lerp(b1, b2, localT)})`;
}

interface FormState {
  name: string;
  notes: string;
  estimatedAmount: string;
  categoryId: number | "";
  targetMonth: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  notes: "",
  estimatedAmount: "",
  categoryId: "",
  targetMonth: "",
};

function toForm(item: PlannedPurchase): FormState {
  return {
    name: item.name,
    notes: item.notes ?? "",
    estimatedAmount: item.estimatedAmount !== null ? String(item.estimatedAmount) : "",
    categoryId: item.categoryId ?? "",
    targetMonth: item.targetMonth ?? "",
  };
}

export function PlannedPurchasesPanel({
  items,
  categories,
  now,
}: {
  items: PlannedPurchase[];
  categories: Category[];
  now: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannedPurchase | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);

  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
  const targetMonthParts = form.targetMonth ? form.targetMonth.split("-") : [];
  const targetMonthNum = targetMonthParts[1] ?? "";
  // El año arranca en el actual por defecto aunque todavía no se eligió mes —
  // así alcanza con tocar el selector de mes la mayoría de las veces.
  const targetYear = targetMonthParts[0] ?? String(currentYear);

  // Año sin mes es válido (ej. "el año que viene, todavía no sé qué mes") —
  // solo mes sin año no tiene sentido, así que un año vacío limpia todo.
  function updateTargetMonth(year: string, month: string) {
    setForm((current) => ({
      ...current,
      targetMonth: !year ? "" : month ? `${year}-${month.padStart(2, "0")}` : year,
    }));
  }

  const pending = items.filter((item) => item.status === "Pendiente");
  const purchased = items.filter((item) => item.status === "Comprado");
  const totalEstimated = pending.reduce((sum, item) => sum + (item.estimatedAmount ?? 0), 0);

  const allDays = items.map((item) => daysSince(item.createdAt, now));
  const minDays = Math.min(...allDays, 0);
  const maxDays = Math.max(...allDays, 0);
  function ageRatio(item: PlannedPurchase): number {
    if (maxDays === minDays) return 0;
    // Más viejo (maxDays) = ratio 0 (verde); más nuevo (minDays) = ratio 1 (rojo).
    return 1 - (daysSince(item.createdAt, now) - minDays) / (maxDays - minDays);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingItem(null);
    setShowCreateModal(true);
  }

  function openEdit(item: PlannedPurchase) {
    setForm(toForm(item));
    setEditingItem(item);
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingItem(null);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount) : null,
      categoryId: form.categoryId === "" ? null : form.categoryId,
      targetMonth: form.targetMonth || null,
    };
    await fetch(
      editingItem ? `/api/planned-purchases/${editingItem.id}` : "/api/planned-purchases",
      {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    setSaving(false);
    closeModal();
    router.refresh();
  }

  async function handleToggleStatus(item: PlannedPurchase) {
    await fetch(`/api/planned-purchases/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status === "Pendiente" ? "Comprado" : "Pendiente" }),
    });
    router.refresh();
  }

  async function handleMove(item: PlannedPurchase, direction: "up" | "down") {
    await fetch(`/api/planned-purchases/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    });
    router.refresh();
  }

  async function handleDelete(item: PlannedPurchase) {
    if (
      !(await confirm({
        description: `¿Eliminar "${item.name}" de la lista de compras?`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/planned-purchases/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  function renderRow(item: PlannedPurchase, index: number, group: PlannedPurchase[]) {
    const priorityRatio = group.length > 1 ? index / (group.length - 1) : 0;
    const days = daysSince(item.createdAt, now);
    return (
      <div
        key={item.id}
        className={`flex items-center gap-2 rounded-control border px-3 py-2.5 ${
          item.status === "Comprado" ? "border-hairline opacity-60" : "border-hairline"
        }`}
      >
        <div className="flex flex-none flex-col">
          <button
            type="button"
            onClick={() => handleMove(item, "up")}
            disabled={index === 0}
            className="px-1 text-[15px] leading-tight text-stone-faint hover:text-sage-700 disabled:opacity-30"
            title="Subir prioridad"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => handleMove(item, "down")}
            disabled={index === group.length - 1}
            className="px-1 text-[15px] leading-tight text-stone-faint hover:text-sage-700 disabled:opacity-30"
            title="Bajar prioridad"
          >
            ▼
          </button>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: statusGradient(priorityRatio) }}
            title={`Prioridad ${index + 1} de ${group.length}`}
          />
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: statusGradient(ageRatio(item)) }}
            title={`Hace ${days} día${days === 1 ? "" : "s"} en la lista`}
          />
        </div>
        <input
          type="checkbox"
          checked={item.status === "Comprado"}
          onChange={() => handleToggleStatus(item)}
          className="h-4 w-4 flex-none accent-sage-600"
        />
        <button
          type="button"
          onClick={() => openEdit(item)}
          className="min-w-0 flex-1 text-left"
          title="Editar"
        >
          <div
            className={`truncate text-[13px] font-medium text-ink ${
              item.status === "Comprado" ? "line-through" : ""
            }`}
          >
            {item.name}
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-stone-light">
            <span className="flex items-center gap-1">
              {item.categoryIcon && <span>{item.categoryIcon}</span>}
              {item.categoryName ?? "Sin categoría"}
            </span>
            <span className="text-stone-faint">·</span>
            {item.status === "Comprado" && item.purchasedAt ? (
              <span title={`Tachado el ${item.purchasedAt.slice(0, 10)}`}>
                tachado el {formatPurchasedDate(item.purchasedAt)}
              </span>
            ) : (
              <span title={`Creado el ${item.createdAt.slice(0, 10)}`}>
                hace {days} día{days === 1 ? "" : "s"}
              </span>
            )}
            {item.notes && (
              <span title={item.notes} className="text-stone-faint">
                📝
              </span>
            )}
          </div>
        </button>
        {item.targetMonth && (
          <span
            className="flex-none rounded-full border-[1.5px] border-sage-border bg-sage-100 px-2 py-0.5 text-[10px] font-semibold text-sage-700"
            title="Mes en el que pensás comprarlo"
          >
            {formatTargetMonth(item.targetMonth)}
          </span>
        )}
        {item.estimatedAmount !== null && (
          <span className="flex-none font-mono text-[12.5px] font-semibold text-ink-muted">
            ${formatAmount(item.estimatedAmount)}
          </span>
        )}
        <button
          type="button"
          onClick={() => handleDelete(item)}
          className="flex-none text-xs text-stone-faint hover:text-terracotta-700"
          title="Eliminar"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-border-dashed p-4">
        <div>
          <span className="text-[11px] font-semibold text-ink-soft">
            {pending.length} pendiente{pending.length === 1 ? "" : "s"}
          </span>
          <span className="ml-2 font-mono text-[11px] text-sage-700">
            (~${formatAmount(totalEstimated)} estimado)
          </span>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          ＋ Agregar
        </button>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeModal}
        >
          <div
            className="w-[420px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">
                {editingItem ? "Editar compra planeada" : "Nueva compra planeada"}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="¿Qué querés comprar?"
                autoFocus
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <CategoryPicker
                    categories={categories}
                    value={form.categoryId}
                    emptyLabel="Categoría (opcional)…"
                    allowEmpty
                    className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border px-2 py-2 text-left text-xs text-ink-muted"
                    onChange={(id) => setForm((current) => ({ ...current, categoryId: id }))}
                  />
                </div>
                <input
                  value={form.estimatedAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, estimatedAmount: event.target.value }))
                  }
                  placeholder="Monto estimado"
                  inputMode="numeric"
                  className="w-[130px] rounded-control border-[1.5px] border-border px-2.5 py-2 text-right font-mono text-xs text-ink-muted"
                />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold text-ink-soft">
                  Mes en el que pensás comprarlo
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={targetMonthNum}
                    onChange={(event) =>
                      updateTargetMonth(targetYear || String(currentYear), event.target.value)
                    }
                    className="flex-1 rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
                  >
                    <option value="">Mes…</option>
                    {MONTH_NAMES.map((name, index) => (
                      <option key={name} value={String(index + 1).padStart(2, "0")}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={targetYear}
                    onChange={(event) => updateTargetMonth(event.target.value, targetMonthNum)}
                    className="w-[90px] rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
                  >
                    <option value="">Año…</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {form.targetMonth && (
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, targetMonth: "" }))}
                      className="flex-none text-stone-faint hover:text-terracotta-700"
                      title="Quitar mes"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Nota (opcional)…"
                rows={2}
                className="resize-none rounded-control border-[1.5px] border-dashed border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
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
                  {saving ? "Guardando…" : editingItem ? "Guardar cambios" : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-stone-light">
            <span className="flex items-center gap-1">
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: `linear-gradient(90deg, ${SAGE}, ${AMBER}, ${TERRACOTTA})` }}
              />
              Prioridad (verde = primero en la lista)
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: `linear-gradient(90deg, ${SAGE}, ${AMBER}, ${TERRACOTTA})` }}
              />
              Antigüedad (verde = más vieja en la lista)
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {pending.map((item, index) => renderRow(item, index, pending))}
        </div>

        {purchased.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowPurchased((current) => !current)}
              className="mb-2 text-[11px] font-semibold text-stone-light hover:text-ink-soft"
            >
              {showPurchased ? "▲" : "▼"} Compradas ({purchased.length})
            </button>
            {showPurchased && (
              <div className="flex flex-col gap-1.5">
                {purchased.map((item, index) => renderRow(item, index, purchased))}
              </div>
            )}
          </div>
        )}

        {items.length === 0 && (
          <div className="py-8 text-center text-[11px] text-stone-faint">
            Todavía no hay nada en la lista de compras.
          </div>
        )}
      </div>
    </div>
  );
}
