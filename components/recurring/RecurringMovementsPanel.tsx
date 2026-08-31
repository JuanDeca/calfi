"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { RecurringMovement, PendingRecurringMovement } from "@/lib/recurringMovements";
import type { ExpenseClass } from "@/types/transaction";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { useConfirm } from "@/components/ui/ConfirmProvider";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount
  );
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function PendingCard({ pending }: { pending: PendingRecurringMovement }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(pending.movement.defaultAmount));
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    if (!Number(amount)) return;
    setSaving(true);
    const usdAmount = pending.movement.defaultAmountUsd;
    const payload: { amount: number; originalAmountUsd?: number; usdExchangeRate?: number } = {
      amount: Number(amount),
    };
    // El tipo de cambio se deriva del monto en pesos que se va a cargar (que
    // Juan puede haber ajustado a mano acá mismo) contra la referencia en
    // dólares de la plantilla — así queda el tipo de cambio real de esta
    // carga puntual, sin depender de una API externa.
    if (usdAmount !== null && usdAmount > 0) {
      payload.originalAmountUsd = usdAmount;
      payload.usdExchangeRate = Math.abs(Number(amount)) / usdAmount;
    }
    await fetch(`/api/recurring-movements/${pending.movement.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 px-3 py-2.5">
      <div className="flex-1">
        <div className="text-xs font-semibold text-ink">{pending.movement.description}</div>
        <div className="text-[10px] text-amber-700">
          {pending.movement.categoryName ?? "Sin categoría"} · {pending.period}
          {pending.movement.defaultAmountUsd !== null &&
            ` · referencia US$${formatUsd(pending.movement.defaultAmountUsd)}`}
        </div>
      </div>
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="numeric"
        className="w-[110px] rounded-control border-[1.5px] border-border px-2 py-1.5 text-right font-mono text-xs text-ink"
      />
      <button
        type="button"
        onClick={handleGenerate}
        disabled={saving}
        className="rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        Generar
      </button>
    </div>
  );
}

export function RecurringMovementsPanel({
  movements,
  pending,
  categories,
}: {
  movements: RecurringMovement[];
  pending: PendingRecurringMovement[];
  categories: Category[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [expenseClass, setExpenseClass] = useState<ExpenseClass>("Fijo");
  const [impactsAnalysis, setImpactsAnalysis] = useState<"Sí" | "No">("Sí");
  const [frequency, setFrequency] = useState<"mensual" | "anual">("mensual");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [monthOfYear, setMonthOfYear] = useState("1");
  const [creating, setCreating] = useState(false);

  const isEditing = editingId !== null;

  function closeModal() {
    setShowCreateModal(false);
    setEditingId(null);
    setDescription("");
    setDefaultAmount("");
    setCategoryId("");
    setExpenseClass("Fijo");
    setImpactsAnalysis("Sí");
    setFrequency("mensual");
    setDayOfMonth("1");
    setMonthOfYear("1");
  }

  function openEditModal(movement: RecurringMovement) {
    setEditingId(movement.id);
    setDescription(movement.description);
    setDefaultAmount(String(movement.defaultAmount));
    setCategoryId(movement.categoryId ?? "");
    setExpenseClass(movement.expenseClass);
    setImpactsAnalysis(movement.impactsAnalysis);
    setFrequency(movement.frequency);
    setDayOfMonth(String(movement.dayOfMonth));
    setMonthOfYear(String(movement.monthOfYear ?? 1));
    setShowCreateModal(true);
  }

  async function handleSubmit() {
    if (!description.trim() || !Number(defaultAmount) || categoryId === "") return;
    setCreating(true);
    const payload = {
      description: description.trim(),
      defaultAmount: Number(defaultAmount),
      categoryId,
      subcategory: null,
      expenseClass,
      impactsAnalysis,
      frequency,
      dayOfMonth: Number(dayOfMonth),
      monthOfYear: Number(monthOfYear),
    };
    if (isEditing) {
      await fetch(`/api/recurring-movements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/recurring-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setCreating(false);
    closeModal();
    router.refresh();
  }

  async function handleToggleActive(id: number, active: boolean) {
    await fetch(`/api/recurring-movements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  async function handleDelete(id: number, description: string) {
    if (
      !(await confirm({
        description: `¿Eliminar "${description}"? Las transacciones ya generadas no se borran.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/recurring-movements/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {pending.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold text-ink-soft">
            Pendientes de generar este período
          </div>
          <div className="grid grid-cols-1 items-start gap-1.5 lg:grid-cols-2">
            {pending.map((item) => (
              <PendingCard key={item.movement.id} pending={item} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="self-start rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white"
      >
        ＋ Nueva plantilla
      </button>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeModal}
        >
          <div
            className="w-[440px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">
                {isEditing ? "Editar plantilla" : "Nueva plantilla"}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción (ej: Alquiler, Salario)…"
                autoFocus
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <CategoryPicker
                    categories={categories}
                    value={categoryId}
                    emptyLabel="Categoría…"
                    allowEmpty
                    className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border px-2 py-2 text-left text-xs text-ink-muted"
                    onChange={(id) => setCategoryId(id)}
                  />
                </div>
                <input
                  value={defaultAmount}
                  onChange={(event) => setDefaultAmount(event.target.value)}
                  placeholder="Monto default"
                  inputMode="numeric"
                  className="w-[120px] rounded-control border-[1.5px] border-border px-2.5 py-2 text-right font-mono text-xs text-ink-muted"
                />
              </div>
              <div className="flex gap-1.5">
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as "mensual" | "anual")}
                  className="flex-1 rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
                {frequency === "mensual" ? (
                  <select
                    value={dayOfMonth}
                    onChange={(event) => setDayOfMonth(event.target.value)}
                    className="w-[100px] rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Día {day}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={monthOfYear}
                    onChange={(event) => setMonthOfYear(event.target.value)}
                    className="w-[120px] rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex gap-1.5">
                <select
                  value={expenseClass}
                  onChange={(event) => setExpenseClass(event.target.value as ExpenseClass)}
                  className="flex-1 rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
                >
                  <option value="Fijo">Fijo</option>
                  <option value="Variable">Variable</option>
                  <option value="Extraordinario">Extraordinario</option>
                  <option value="No aplica">No aplica</option>
                </select>
                <div className="flex overflow-hidden rounded-control border-[1.5px] border-border text-[10.5px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setImpactsAnalysis("Sí")}
                    className={`px-2.5 py-2 ${
                      impactsAnalysis === "Sí" ? "bg-sage-600 text-white" : "text-stone-light"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactsAnalysis("No")}
                    className={`px-2.5 py-2 ${
                      impactsAnalysis === "No" ? "bg-sage-600 text-white" : "text-stone-light"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
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
                  onClick={handleSubmit}
                  disabled={creating}
                  className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {creating ? "Guardando…" : isEditing ? "Guardar" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-semibold text-ink-soft">Todas las plantillas</div>
        <div className="grid grid-cols-1 items-start gap-1.5 lg:grid-cols-2">
          {movements.map((movement) => (
            <div
              key={movement.id}
              className={`flex items-center gap-2 rounded-control border px-2.5 py-1.5 ${
                movement.active ? "border-hairline" : "border-dashed border-stone-faint opacity-60"
              }`}
            >
              <div className="flex-1">
                <div className="text-xs font-medium text-ink">{movement.description}</div>
                <div className="text-[9.5px] text-stone-faint">
                  {movement.categoryName ?? "Sin categoría"} ·{" "}
                  {movement.frequency === "mensual"
                    ? `Mensual, día ${movement.dayOfMonth}`
                    : `Anual, ${MONTHS[(movement.monthOfYear ?? 1) - 1]}`}
                </div>
              </div>
              <span className="text-right font-mono text-xs text-ink-muted">
                ${formatAmount(movement.defaultAmount)}
                {movement.defaultAmountUsd !== null && (
                  <span className="block text-[9.5px] text-stone-faint">
                    US${formatUsd(movement.defaultAmountUsd)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleToggleActive(movement.id, movement.active)}
                className={`rounded-full border-[1.5px] px-2 py-0.5 text-[9.5px] font-semibold ${
                  movement.active
                    ? "border-sage-border bg-sage-100 text-sage-700"
                    : "border-neutral-border bg-neutral-100 text-stone-light"
                }`}
              >
                {movement.active ? "Activa" : "Pausada"}
              </button>
              <button
                type="button"
                onClick={() => openEditModal(movement)}
                className="text-xs text-stone-faint hover:text-ink"
                title="Editar plantilla"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => handleDelete(movement.id, movement.description)}
                className="text-xs text-stone-faint hover:text-terracotta-700"
                title="Eliminar plantilla"
              >
                ✕
              </button>
            </div>
          ))}
          {movements.length === 0 && (
            <div className="py-4 text-center text-[11px] text-stone-faint">
              Todavía no cargaste ninguna plantilla.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
