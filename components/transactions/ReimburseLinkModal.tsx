"use client";

import { useState } from "react";
import type { Transaction } from "@/types/transaction";
import type { TransactionSearchResult } from "@/lib/transactions";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(amount));
}

interface ReimburseLinkModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

export function ReimburseLinkModal({ transaction, onClose, onSaved }: ReimburseLinkModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransactionSearchResult[]>([]);
  const [selected, setSelected] = useState<{ id: number; description: string } | null>(
    transaction.reimbursesTransactionId
      ? { id: transaction.reimbursesTransactionId, description: transaction.reimbursesDescription ?? "" }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(
      `/api/transactions/search?q=${encodeURIComponent(value)}&sign=negative&excludeId=${transaction.id}`
    );
    const data = await response.json();
    setResults(data.results ?? []);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/transactions/${transaction.id}/reimburse`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId: selected?.id ?? null }),
    });

    if (!response.ok) {
      setError("No se pudo guardar el vínculo.");
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[420px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">Vincular a un gasto</span>
        </div>

        <div className="px-[18px] py-4">
          <div className="mb-4 flex items-center justify-between rounded-control bg-cream-soft px-3.5 py-3">
            <div className="text-[12.5px] font-medium text-ink">{transaction.description}</div>
            <div className="font-mono text-sm font-bold text-sage-700">
              +${formatAmount(transaction.amount)}
            </div>
          </div>

          {selected && (
            <div className="mb-3 flex items-center justify-between rounded-control border-[1.5px] border-sage-border bg-sage-50 px-3 py-2">
              <span className="text-[11.5px] text-sage-700">
                Vinculado a: <b>{selected.description}</b>
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[11px] font-semibold text-terracotta-700"
              >
                Quitar
              </button>
            </div>
          )}

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Buscar el gasto que reintegra
          </label>
          <input
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Ej. asado, carne…"
            className="mb-1.5 w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
          />

          {results.length > 0 && (
            <div className="mb-3 max-h-48 overflow-auto rounded-control border-[1.5px] border-border">
              {results.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => {
                    setSelected({ id: result.id, description: result.description });
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center justify-between border-b border-hairline px-3 py-2 text-left last:border-b-0 hover:bg-cream-soft"
                >
                  <span className="text-[12px] text-ink">{result.description}</span>
                  <span className="font-mono text-[11.5px] text-ink-soft">
                    –${formatAmount(result.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && <div className="mb-3 text-[11.5px] text-terracotta-700">{error}</div>}

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
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
