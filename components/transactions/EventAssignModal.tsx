"use client";

import { useState } from "react";
import type { Event } from "@/lib/events";
import type { Transaction } from "@/types/transaction";

interface EventAssignModalProps {
  transaction: Transaction;
  events: Event[];
  onClose: () => void;
  onSaved: () => void;
}

export function EventAssignModal({ transaction, events, onClose, onSaved }: EventAssignModalProps) {
  const [eventId, setEventId] = useState<number | "">(transaction.eventId ?? "");
  const [newEventName, setNewEventName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    let targetEventId: number | null = eventId === "" ? null : eventId;

    if (newEventName.trim()) {
      const createResponse = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName.trim(), description: null }),
      });
      if (!createResponse.ok) {
        setError("No se pudo crear el evento.");
        setSaving(false);
        return;
      }
      const data = await createResponse.json();
      targetEventId = data.id;
    }

    const response = await fetch(`/api/transactions/${transaction.id}/event`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: targetEventId }),
    });

    if (!response.ok) {
      setError("No se pudo asignar el evento.");
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[400px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
          <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
          <span className="font-kalam text-sm font-bold text-ink">Asignar a evento</span>
        </div>

        <div className="px-[18px] py-4">
          <div className="mb-4 text-[12.5px] font-medium text-ink">{transaction.description}</div>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Evento existente
          </label>
          <select
            value={eventId}
            onChange={(event) => {
              setEventId(event.target.value ? Number(event.target.value) : "");
              setNewEventName("");
            }}
            className="mb-3.5 w-full rounded-control border-[1.5px] border-border px-3 py-2 text-[12.5px] text-ink-muted"
          >
            <option value="">Ninguno</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            O crear uno nuevo
          </label>
          <input
            value={newEventName}
            onChange={(event) => {
              setNewEventName(event.target.value);
              if (event.target.value) setEventId("");
            }}
            placeholder="Ej. Vacaciones Brasil"
            className="mb-4 w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-[12.5px] text-ink-muted"
          />

          {error && <div className="mb-3 text-[11.5px] text-terracotta-700">{error}</div>}

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
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
