"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetOrDebt } from "@/lib/patrimonio";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { formatMoney } from "@/lib/formatMoney";

interface AccountsPanelProps {
  kind: "assets" | "debts";
  title: string;
  accounts: AssetOrDebt[];
  currency?: "ARS" | "USD";
  usdFactor?: number;
}

export function AccountsPanel({
  kind,
  title,
  accounts,
  currency = "ARS",
  usdFactor = 1,
}: AccountsPanelProps) {
  const apiBase = `/api/${kind}`;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const router = useRouter();
  const confirm = useConfirm();

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim(),
        currentValue: Number(initialValue) || 0,
      }),
    });
    setName("");
    setType("");
    setInitialValue("");
    setCreating(false);
    setShowCreateModal(false);
    router.refresh();
  }

  async function handleSaveValue(id: number) {
    const draft = drafts[id];
    if (draft === undefined) return;
    await fetch(`${apiBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentValue: Number(draft) || 0 }),
    });
    setDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(id)))
    );
    router.refresh();
  }

  async function handleToggleIncluded(id: number, includedInBalance: boolean) {
    await fetch(`${apiBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includedInBalance: !includedInBalance }),
    });
    router.refresh();
  }

  async function handleDelete(id: number, name: string) {
    if (
      !(await confirm({
        description: `¿Eliminar "${name}"? También se borra su historial de valores.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`${apiBase}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex-1 border-border-dashed p-4 first:border-b-[1.5px] first:border-dashed sm:first:border-b-0 sm:first:border-r-[1.5px]">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink-soft">{title}</span>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-control bg-sage-600 px-2.5 py-1 text-[11px] font-semibold text-white"
        >
          ＋ Nueva
        </button>
      </div>

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
              <span className="font-kalam text-sm font-bold text-ink">Nueva cuenta — {title}</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre…"
                autoFocus
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                placeholder="Tipo (ej. Efectivo)"
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <input
                value={initialValue}
                onChange={(event) => setInitialValue(event.target.value)}
                placeholder="Valor inicial"
                inputMode="numeric"
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-right font-mono text-xs text-ink-muted"
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
                  onClick={handleCreate}
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

      <div className="flex flex-col gap-1.5">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`flex items-center gap-2 rounded-control border px-2.5 py-1.5 ${
              account.includedInBalance ? "border-hairline" : "border-dashed border-stone-faint opacity-60"
            }`}
          >
            <div className="flex-1">
              <div className="text-xs font-medium text-ink">{account.name}</div>
              <div className="text-[9.5px] text-stone-faint">{account.type}</div>
            </div>
            {currency === "USD" ? (
              <span
                className="w-[100px] text-right font-mono text-xs text-ink"
                title="Cambiá a ARS para editar el valor"
              >
                {formatMoney(account.currentValue * usdFactor, "USD")}
              </span>
            ) : (
              <input
                defaultValue={account.currentValue}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [account.id]: event.target.value }))
                }
                onBlur={() => handleSaveValue(account.id)}
                inputMode="numeric"
                className="w-[100px] rounded-control border-[1.5px] border-border px-2 py-1 text-right font-mono text-xs text-ink"
              />
            )}
            <button
              type="button"
              onClick={() => handleToggleIncluded(account.id, account.includedInBalance)}
              title={
                account.includedInBalance
                  ? "Incluida en el patrimonio — click para excluir"
                  : "Excluida del patrimonio — click para incluir"
              }
              className={`rounded-full border-[1.5px] px-2 py-0.5 text-[9.5px] font-semibold ${
                account.includedInBalance
                  ? "border-sage-border bg-sage-100 text-sage-700"
                  : "border-neutral-border bg-neutral-100 text-stone-light"
              }`}
            >
              {account.includedInBalance ? "Incluida" : "Excluida"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(account.id, account.name)}
              className="text-xs text-stone-faint hover:text-terracotta-700"
              title="Eliminar"
            >
              ✕
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="py-4 text-center text-[11px] text-stone-faint">
            Todavía no cargaste ninguna cuenta.
          </div>
        )}
      </div>
    </div>
  );
}
