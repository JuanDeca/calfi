"use client";

import { useEffect, useState } from "react";
import type { Transaction } from "@/types/transaction";
import type { TransactionSearchResult } from "@/lib/transactions";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(amount));
}

interface ReimbursementsModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

export function ReimbursementsModal({ transaction, onClose, onSaved }: ReimbursementsModalProps) {
  const total = Math.abs(transaction.amount);
  const [linked, setLinked] = useState<TransactionSearchResult[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [expected, setExpected] = useState(String(transaction.reimbursementExpected ?? ""));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransactionSearchResult[]>([]);
  const [dirty, setDirty] = useState(false);

  async function loadLinked() {
    setLoadingLinked(true);
    const response = await fetch(`/api/transactions/${transaction.id}/reimbursements`);
    const data = await response.json();
    setLinked(data.results ?? []);
    setLoadingLinked(false);
  }

  useEffect(() => {
    loadLinked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = linked.reduce((acc, item) => acc + item.amount, 0);
  const expectedNumber = expected.trim() ? Number(expected) : null;

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(
      `/api/transactions/search?q=${encodeURIComponent(value)}&sign=positive&excludeId=${transaction.id}`
    );
    const data = await response.json();
    setResults(data.results ?? []);
  }

  async function handleLink(id: number) {
    await fetch(`/api/transactions/${id}/reimburse`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId: transaction.id }),
    });
    setQuery("");
    setResults([]);
    setDirty(true);
    loadLinked();
  }

  async function handleUnlink(id: number) {
    await fetch(`/api/transactions/${id}/reimburse`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId: null }),
    });
    setDirty(true);
    loadLinked();
  }

  async function handleSaveExpected() {
    await fetch(`/api/transactions/${transaction.id}/reimbursement-expected`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: expectedNumber }),
    });
    setDirty(true);
  }

  function handleClose() {
    if (dirty) onSaved();
    else onClose();
  }

  const missing = expectedNumber !== null ? expectedNumber - sum : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[460px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">Reintegros del gasto</span>
        </div>

        <div className="px-[18px] py-4">
          <div className="mb-4 flex items-center justify-between rounded-control bg-cream-soft px-3.5 py-3">
            <div className="text-[12.5px] font-medium text-ink">{transaction.description}</div>
            <div className="font-mono text-sm font-bold text-ink">–${formatAmount(total)}</div>
          </div>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Monto que esperás recibir en total{" "}
            <span className="font-normal text-stone-faint">
              (dejá vacío si no tenés un número esperado; si vos también pagaste tu parte, poné menos que el total)
            </span>
          </label>
          <div className="mb-3.5 flex gap-1.5">
            <input
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              placeholder={`Ej. ${formatAmount(total)}`}
              inputMode="numeric"
              className="flex-1 rounded-control border-[1.5px] border-border px-3 py-2 text-[12.5px] text-ink-muted"
            />
            <button
              type="button"
              onClick={handleSaveExpected}
              className="rounded-control border-[1.5px] border-sage-border bg-sage-100 px-3 text-xs font-semibold text-sage-700"
            >
              Guardar
            </button>
          </div>

          <div className="mb-2 text-[10.5px] font-semibold text-ink-soft">
            Reintegros vinculados {loadingLinked && "(cargando…)"}
          </div>
          <div className="mb-3 max-h-40 overflow-auto rounded-control border-[1.5px] border-border">
            {linked.length === 0 && !loadingLinked && (
              <div className="px-3 py-2.5 text-[11.5px] text-stone-faint">
                Todavía no vinculaste ningún reintegro.
              </div>
            )}
            {linked.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-hairline px-3 py-2 last:border-b-0"
              >
                <span className="text-[12px] text-ink">{item.description}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11.5px] text-sage-700">
                    +${formatAmount(item.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnlink(item.id)}
                    className="text-[11px] text-stone-faint hover:text-terracotta-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Vincular otro reintegro
          </label>
          <input
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Buscar transferencia recibida…"
            className="mb-1.5 w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
          />
          {results.length > 0 && (
            <div className="mb-3 max-h-40 overflow-auto rounded-control border-[1.5px] border-border">
              {results.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => handleLink(result.id)}
                  className="flex w-full items-center justify-between border-b border-hairline px-3 py-2 text-left last:border-b-0 hover:bg-cream-soft"
                >
                  <span className="text-[12px] text-ink">{result.description}</span>
                  <span className="font-mono text-[11.5px] text-sage-700">
                    +${formatAmount(result.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t-[1.5px] border-dashed border-border-dashed py-3">
            <span className="text-xs text-ink-soft">
              Recibido <b className="text-sage-700">${formatAmount(sum)}</b>
              {expectedNumber !== null && <> de ${formatAmount(expectedNumber)} esperado</>}
            </span>
            {expectedNumber !== null && missing !== null && missing > 0.5 && (
              <span className="font-mono text-[11.5px] font-bold text-terracotta-700">
                Te deben ${formatAmount(missing)}
              </span>
            )}
            {expectedNumber !== null && missing !== null && missing <= 0.5 && (
              <span className="font-mono text-[11.5px] font-bold text-sage-700">Completo ✓</span>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
