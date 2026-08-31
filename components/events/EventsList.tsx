"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventSummary } from "@/lib/events";
import { useConfirm } from "@/components/ui/ConfirmProvider";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

export function EventsList({ events }: { events: EventSummary[] }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const maxTotal = Math.max(1, ...events.map((event) => event.totalAmount));

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: null }),
    });
    setName("");
    setCreating(false);
    router.refresh();
  }

  async function handleDelete(id: number, name: string, mouseEvent: React.MouseEvent) {
    mouseEvent.preventDefault();
    if (
      !(await confirm({
        description: `¿Eliminar el evento "${name}"? Sus transacciones no se borran, solo quedan sin evento asignado.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mb-4 flex gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nuevo evento… (ej. Vacaciones Brasil)"
          className="flex-1 rounded-control border-[1.5px] border-border px-3 py-2 text-xs text-ink-muted"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-control bg-sage-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          ＋ Crear
        </button>
      </div>

      {events.length === 0 ? (
        <div className="py-10 text-center text-xs text-stone-faint">
          Todavía no hay eventos. Creá uno o asigná una transacción a un evento nuevo desde
          Transacciones.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}`}
              className="block rounded-control border-[1.5px] border-border px-4 py-3 hover:border-sage-600"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-ink">{event.name}</div>
                  <div className="text-[10.5px] text-stone-light">
                    {event.transactionCount} movimientos
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-[15px] font-bold text-terracotta-700">
                      ${formatAmount(event.totalAmount)}
                    </div>
                    <div className="text-[9.5px] text-stone-faint">agrupado</div>
                  </div>
                  <button
                    type="button"
                    onClick={(clickEvent) => handleDelete(event.id, event.name, clickEvent)}
                    className="text-xs text-stone-faint hover:text-terracotta-700"
                    title="Eliminar evento"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-hairline">
                <div
                  className="h-full bg-terracotta-600"
                  style={{ width: `${(event.totalAmount / maxTotal) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
