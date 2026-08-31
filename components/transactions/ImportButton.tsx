"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".pdf")) {
      setStatus({
        kind: "error",
        message: "El archivo tiene que ser un .xlsx o .pdf exportado de Mercado Pago.",
      });
      return;
    }

    setStatus({ kind: "loading" });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/transactions/import", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      setStatus({ kind: "error", message: data.error ?? "Error al importar el archivo." });
      return;
    }

    if (data.total === 0) {
      setStatus({ kind: "error", message: "El archivo no tiene movimientos para importar." });
      return;
    }

    setStatus({
      kind: "success",
      message:
        data.imported === 0
          ? `Los ${data.total} movimientos del archivo ya estaban importados.`
          : `Importadas ${data.imported} de ${data.total} (${data.skippedDuplicates} ya existían).`,
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.pdf"
        className="hidden"
        onChange={handleFileSelected}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status.kind === "loading"}
        className="inline-flex items-center gap-1.5 rounded-control bg-sage-600 px-3.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60"
      >
        {status.kind === "loading" ? "Importando…" : "↑ Importar"}
      </button>
      {status.kind === "success" && (
        <span className="text-[11px] font-medium text-sage-700">{status.message}</span>
      )}
      {status.kind === "error" && (
        <span className="text-[11px] font-medium text-terracotta-700">{status.message}</span>
      )}
    </div>
  );
}
