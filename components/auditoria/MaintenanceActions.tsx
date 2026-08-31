"use client";

import { useState } from "react";

export function MaintenanceActions() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleBackupNow() {
    setStatus("Haciendo backup…");
    const response = await fetch("/api/admin/backup-now", { method: "POST" });
    if (response.ok) {
      setStatus("Backup actualizado ✓");
    } else {
      setStatus("No se pudo hacer el backup.");
    }
    setTimeout(() => setStatus(null), 4000);
  }

  return (
    <div className="mt-5 flex max-w-[500px] items-center gap-2.5">
      <a
        href="/api/export/transactions"
        className="rounded-control border-[1.5px] border-border px-3.5 py-2 text-[11.5px] font-semibold text-ink-soft"
      >
        ↓ Exportar transacciones (CSV)
      </a>
      <button
        type="button"
        onClick={handleBackupNow}
        className="rounded-control border-[1.5px] border-sage-border bg-sage-50 px-3.5 py-2 text-[11.5px] font-semibold text-sage-700"
      >
        Forzar backup ahora
      </button>
      {status && <span className="text-[11px] text-stone-light">{status}</span>}
    </div>
  );
}
