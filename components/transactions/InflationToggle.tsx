"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_LABELS[Number(monthNumber) - 1]} ${year}`;
}

export function InflationToggle({
  referenceMonth,
  basePath = "/transacciones",
}: {
  referenceMonth: string | null;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("adjustInflation") === "1";

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete("adjustInflation");
    else params.set("adjustInflation", "1");
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!referenceMonth}
      title={
        referenceMonth
          ? `Ajustar montos a pesos de ${formatMonth(referenceMonth)} (IPC)`
          : "No se pudo obtener el índice de inflación (sin conexión)"
      }
      className={`rounded-control border-[1.5px] px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-50 ${
        active ? "border-sage-600 bg-sage-100 text-sage-700" : "border-border text-ink-muted"
      }`}
    >
      {active && referenceMonth ? `Ajustado a ${formatMonth(referenceMonth)}` : "Ajustar por inflación"}
    </button>
  );
}
