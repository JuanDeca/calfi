"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function MergeSubcategoryForm({
  categoryId,
  subcategories,
}: {
  categoryId: number;
  subcategories: string[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (subcategories.length < 2) return null;

  async function handleMerge() {
    if (!from || !to) return;
    if (
      !(await confirm({
        title: "Unificar subcategoría",
        description: `¿Unificar "${from}" en "${to}"? Se van a actualizar todas las transacciones y reglas de esta categoría que usan "${from}".`,
        confirmLabel: "Unificar",
      }))
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/categories/${categoryId}/subcategories/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo unificar.");
      return;
    }

    setMessage(`Listo — se actualizaron ${data.updated} transacción(es).`);
    setFrom("");
    setTo("");
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-dashed border-border-dashed pt-3">
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-control border-[1.5px] border-dashed border-border px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft"
      >
        Unificar subcategorías…
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-[380px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">Unificar subcategorías</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <label className="flex flex-col gap-1 text-[10.5px] font-semibold text-ink-soft">
                Origen
                <select
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
                >
                  <option value="">Elegí una subcategoría…</option>
                  {subcategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10.5px] font-semibold text-ink-soft">
                Destino
                <select
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
                >
                  <option value="">Elegí una subcategoría…</option>
                  {subcategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {message && <div className="text-[10.5px] text-stone-light">{message}</div>}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={saving || !from || !to}
                  className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Unificando…" : "Unificar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
