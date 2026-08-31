"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AssetOrDebt } from "@/lib/patrimonio";
import type {
  BucketWithBalance,
  AllocationRun,
  AllocationBreakdown,
  UsdReplenishment,
  AllocationSubItem,
} from "@/lib/salaryAllocation";
import type { PendingRecurringMovement } from "@/lib/recurringMovements";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { SalaryAllocationPieChart } from "@/components/salaryAllocation/SalaryAllocationPieChart";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount
  );
}

function formatDate(isoDatetime: string): string {
  return new Date(isoDatetime.replace(" ", "T") + "Z").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** `transactions.date` es una fecha plana ("YYYY-MM-DD", sin hora) — se formatea
 * por texto en vez de pasar por `Date` para no arriesgar un corrimiento de día
 * por huso horario. */
function formatPlainDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function BucketCard({
  bucket,
  referenceValue,
  lastRunSubItems,
  onConfirm,
}: {
  bucket: BucketWithBalance;
  referenceValue?: { amount: number; label: string } | null;
  lastRunSubItems?: AllocationSubItem[] | null;
  onConfirm: (value: number) => Promise<void>;
}) {
  const [showConfirmInput, setShowConfirmInput] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    if (!Number(confirmValue)) return;
    setConfirming(true);
    await onConfirm(Number(confirmValue));
    setConfirming(false);
    setShowConfirmInput(false);
    setConfirmValue("");
  }

  return (
    <div
      className={`flex h-full flex-col rounded-control border-[1.5px] p-3.5 ${
        bucket.active ? "border-border-dashed" : "border-dashed border-stone-faint opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{bucket.label}</span>
        <div className="flex items-center gap-1.5">
          {bucket.percentage !== null && (
            <span className="rounded-control bg-sage-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-sage-700">
              {bucket.percentage}%
            </span>
          )}
          {!bucket.active && (
            <span className="rounded-control bg-neutral-100 px-2 py-0.5 text-[9.5px] font-semibold text-stone-light">
              No aplica este mes
            </span>
          )}
        </div>
      </div>
      {referenceValue != null && (
        <div className="mt-1.5 font-mono text-lg font-bold text-ink">
          ${formatAmount(referenceValue.amount)}
          <span className="ml-1.5 font-sans text-[10px] font-medium text-stone-faint">
            {referenceValue.label}
          </span>
        </div>
      )}
      {bucket.pocketBalance !== null && (
        <>
          <div className={referenceValue != null ? "mt-1 font-mono text-[11px] text-stone-light" : "mt-1.5 font-mono text-lg font-bold text-ink"}>
            ${formatAmount(bucket.pocketBalance)}
            <span className={referenceValue != null ? "ml-1.5 font-sans text-[10px] text-stone-faint" : "ml-1.5 font-sans text-[10px] font-medium text-stone-faint"}>
              {referenceValue != null ? "transitorio en pesos (MP)" : "reservado en MP"}
              {bucket.pocketConfirmedAt ? " · estimado" : ""}
            </span>
          </div>
          {bucket.pocketLastActivity && (
            <div className="mt-0.5 text-[9.5px] text-stone-faint">
              Actualizado en: {formatPlainDate(bucket.pocketLastActivity)}
            </div>
          )}

          {!showConfirmInput ? (
            <button
              type="button"
              onClick={() => setShowConfirmInput(true)}
              className={`mt-1.5 self-start rounded-control px-2 py-1 text-left text-[10px] font-semibold ${
                bucket.needsReconfirmation
                  ? "border-[1.5px] border-dashed border-amber-border bg-amber-50 text-amber-700"
                  : "text-sage-700 hover:underline"
              }`}
            >
              {bucket.needsReconfirmation
                ? "🔔 Hace más de 90 días que no confirmás este saldo — ¿cuánto tiene realmente?"
                : "Confirmar saldo real"}
            </button>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                value={confirmValue}
                onChange={(event) => setConfirmValue(event.target.value)}
                placeholder="Saldo real…"
                inputMode="numeric"
                autoFocus
                className="w-[100px] rounded-control border-[1.5px] border-border px-2 py-1 text-right font-mono text-[11px] text-ink-muted"
              />
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded-control bg-sage-600 px-2 py-1 text-[10.5px] font-semibold text-white disabled:opacity-60"
              >
                {confirming ? "…" : "OK"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmInput(false)}
                className="text-[10.5px] text-stone-faint"
              >
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
      {(bucket.destinationNote || (lastRunSubItems && lastRunSubItems.length > 0)) && (
        <div className="mt-1.5 flex-1">
          {bucket.destinationNote && (
            <div className="text-[10.5px] leading-snug text-stone-light">{bucket.destinationNote}</div>
          )}
          {lastRunSubItems && lastRunSubItems.length > 0 && (
            <div
              className={`flex flex-col gap-0.5 ${bucket.destinationNote ? "mt-1.5 border-t border-dashed border-border-dashed pt-1.5" : ""}`}
            >
              <div className="text-[9.5px] font-semibold text-stone-faint">Según el último reparto:</div>
              {lastRunSubItems.map((sub) => (
                <div key={sub.label} className="flex items-center justify-between">
                  <span className="text-[10.5px] text-ink-soft">{sub.label}</span>
                  <span className="font-mono text-[10.5px] font-semibold text-ink-muted">
                    ${formatAmount(sub.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SalaryAllocationPanel({
  buckets,
  bancoUsd,
  inversionesUsd,
  deudasUsd,
  lastRun,
  usdReplenishment,
  pendingRecurring,
}: {
  buckets: BucketWithBalance[];
  bancoUsd: AssetOrDebt | null;
  inversionesUsd: AssetOrDebt | null;
  deudasUsd: AssetOrDebt | null;
  lastRun: AllocationRun | null;
  usdReplenishment: UsdReplenishment;
  pendingRecurring: PendingRecurringMovement[];
}) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [percentageDrafts, setPercentageDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const [showChecklist, setShowChecklist] = useState(false);
  const [grossAmount, setGrossAmount] = useState("");
  const [breakdown, setBreakdown] = useState<AllocationBreakdown | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [calculating, setCalculating] = useState(false);

  function openEditModal() {
    const drafts: Record<number, string> = {};
    for (const bucket of buckets) {
      if (bucket.percentage !== null) drafts[bucket.id] = String(bucket.percentage);
    }
    setPercentageDrafts(drafts);
    setShowEditModal(true);
  }

  async function handleSavePercentages() {
    setSaving(true);
    await Promise.all(
      Object.entries(percentageDrafts).map(([id, value]) =>
        fetch(`/api/salary-allocation/buckets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ percentage: Number(value) }),
        })
      )
    );
    setSaving(false);
    setShowEditModal(false);
    router.refresh();
  }

  async function handleCalculate() {
    if (!Number(grossAmount)) return;
    setCalculating(true);
    const response = await fetch("/api/salary-allocation/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grossAmount: Number(grossAmount) }),
    });
    const data = (await response.json()) as { breakdown: AllocationBreakdown };
    setBreakdown(data.breakdown);
    setCheckedKeys(new Set());
    setCalculating(false);
    router.refresh();
  }

  function toggleChecked(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function closeChecklist() {
    setShowChecklist(false);
    setGrossAmount("");
    setBreakdown(null);
    setCheckedKeys(new Set());
  }

  async function handleConfirmBalance(bucketId: number, value: number) {
    await fetch(`/api/salary-allocation/buckets/${bucketId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedBalance: value }),
    });
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setShowChecklist(true)}
          className="rounded-control bg-sage-600 px-3.5 py-2 text-xs font-semibold text-white"
        >
          💰 Cobré el sueldo
        </button>
        <button
          type="button"
          onClick={openEditModal}
          className="rounded-control border-[1.5px] border-border px-3.5 py-2 text-xs font-semibold text-ink-soft"
        >
          Editar porcentajes
        </button>
        {lastRun && (
          <span className="text-[11px] text-stone-light">
            Último reparto: ${formatAmount(lastRun.grossAmount)} el {formatDate(lastRun.createdAt)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {bancoUsd && (
          <div className="self-start rounded-control border-[1.5px] border-sage-border bg-sage-100 p-3.5">
            <div className="font-mono text-[10px] font-semibold text-sage-600">
              BANCO (USD) — COLCHÓN / FONDO DE EMERGENCIA
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink">
              ${formatAmount(bancoUsd.currentValue)}
            </div>
            <div className="mt-1 text-[10.5px] text-sage-700">
              Saldo de referencia — se actualiza a mano desde Patrimonio.
            </div>
          </div>
        )}

        {usdReplenishment.totalUsd > 0 && (
          <div className="self-start rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 p-3.5">
            <div className="font-mono text-[10px] font-semibold text-amber-700">
              REPONER AL COLCHÓN — SUSCRIPCIONES USD DE {usdReplenishment.monthLabel.toUpperCase()}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink">
              US${formatUsd(usdReplenishment.totalUsd)}
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {usdReplenishment.items.map((item) => (
                <div key={`${item.date}-${item.description}`} className="text-[10.5px] text-amber-700">
                  {item.description}: US${formatUsd(item.usdAmount)}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingRecurring.length > 0 && (
          <div className="self-start rounded-control border-[1.5px] border-dashed border-terracotta-600 bg-terracotta-100 p-3.5">
            <div className="font-mono text-[10px] font-semibold text-terracotta-700">
              MOVIMIENTOS FIJOS SIN GENERAR ESTE PERÍODO
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink">{pendingRecurring.length}</div>
            <div className="mt-1 flex flex-col gap-0.5">
              {pendingRecurring.map(({ movement, period }) => (
                <div key={movement.id} className="text-[10.5px] text-terracotta-700">
                  {movement.description} ({period})
                </div>
              ))}
            </div>
            <Link
              href="/movimientos-fijos"
              className="mt-1.5 inline-block text-[10.5px] font-semibold text-terracotta-700 underline"
            >
              Ir a generarlos →
            </Link>
          </div>
        )}
      </div>

      <InsightPanel title="Cómo se reparte el sueldo">
        <SalaryAllocationPieChart buckets={buckets} />
      </InsightPanel>

      <div className="grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((bucket) => {
          let referenceValue: { amount: number; label: string } | null = null;
          if (bucket.key === "inversion" && inversionesUsd) {
            referenceValue = { amount: inversionesUsd.currentValue, label: "invertido en PPI (ETFs)" };
          } else if (bucket.key === "deudas" && deudasUsd) {
            referenceValue = { amount: deudasUsd.currentValue, label: "reserva en USD (MP)" };
          }
          const lastRunSubItems =
            lastRun?.breakdown.items.find((item) => item.key === bucket.key)?.subItems ?? null;
          return (
            <BucketCard
              key={bucket.id}
              bucket={bucket}
              referenceValue={referenceValue}
              lastRunSubItems={lastRunSubItems}
              onConfirm={(value) => handleConfirmBalance(bucket.id, value)}
            />
          );
        })}
      </div>

      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="w-[380px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">Editar porcentajes</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              {buckets
                .filter((bucket) => bucket.percentage !== null)
                .map((bucket) => (
                  <div key={bucket.id} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-ink-muted">{bucket.label}</span>
                    <input
                      value={percentageDrafts[bucket.id] ?? ""}
                      onChange={(event) =>
                        setPercentageDrafts((prev) => ({ ...prev, [bucket.id]: event.target.value }))
                      }
                      inputMode="decimal"
                      className="w-[70px] rounded-control border-[1.5px] border-border px-2 py-1.5 text-right font-mono text-xs text-ink-muted"
                    />
                    <span className="text-xs text-stone-faint">%</span>
                  </div>
                ))}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePercentages}
                  disabled={saving}
                  className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChecklist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeChecklist}
        >
          <div
            className="w-[480px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">💰 Cobré el sueldo</span>
            </div>
            <div className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto px-[18px] py-4">
              {!breakdown ? (
                <>
                  <input
                    value={grossAmount}
                    onChange={(event) => setGrossAmount(event.target.value)}
                    placeholder="Sueldo bruto…"
                    inputMode="numeric"
                    autoFocus
                    className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-right font-mono text-sm text-ink-muted"
                  />
                  <button
                    type="button"
                    onClick={handleCalculate}
                    disabled={calculating}
                    className="rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {calculating ? "Calculando…" : "Calcular"}
                  </button>
                </>
              ) : (
                <>
                  {breakdown.items.map((item) => (
                    <label
                      key={item.key}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 px-3 py-2.5 ${
                        checkedKeys.has(item.key) ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedKeys.has(item.key)}
                        onChange={() => toggleChecked(item.key)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink">{item.label}</span>
                          <span className="font-mono text-xs font-semibold text-amber-700">
                            ${formatAmount(item.amount)}
                          </span>
                        </div>
                        {item.destinationNote && (
                          <div className="mt-1 text-[10.5px] leading-snug text-amber-700">
                            {item.destinationNote}
                          </div>
                        )}
                        {item.subItems && (
                          <div className="mt-1.5 flex flex-col gap-0.5 border-t border-dashed border-amber-border pt-1.5">
                            {item.subItems.map((sub) => (
                              <div key={sub.label} className="flex items-center justify-between">
                                <span className="text-[10.5px] text-amber-700">{sub.label}</span>
                                <span className="font-mono text-[10.5px] font-semibold text-amber-700">
                                  ${formatAmount(sub.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                  {breakdown.usdReplenishment.totalUsd > 0 && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-control border-[1.5px] border-dashed border-amber-border bg-amber-50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checkedKeys.has("usd_replenishment")}
                        onChange={() => toggleChecked("usd_replenishment")}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink">
                            Reponer al colchón (USD {breakdown.usdReplenishment.monthLabel})
                          </span>
                          <span className="font-mono text-xs font-semibold text-amber-700">
                            US${formatUsd(breakdown.usdReplenishment.totalUsd)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {breakdown.usdReplenishment.items.map((item) => (
                            <div key={`${item.date}-${item.description}`} className="text-[10.5px] text-amber-700">
                              {item.description}: US${formatUsd(item.usdAmount)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </label>
                  )}
                  <div className="flex items-center justify-between rounded-control border-[1.5px] border-sage-border bg-sage-100 px-3 py-2.5">
                    <span className="text-xs font-semibold text-sage-700">Resto (día a día)</span>
                    <span className="font-mono text-xs font-semibold text-sage-700">
                      ${formatAmount(breakdown.resto)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeChecklist}
                    className="mt-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                  >
                    Listo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
