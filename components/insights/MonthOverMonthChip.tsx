import type { MonthComparison } from "@/lib/insights";

export function MonthOverMonthChip({ comparison }: { comparison: MonthComparison | null }) {
  if (!comparison) return null;
  const up = comparison.deltaPct > 0;
  const flat = Math.abs(comparison.deltaPct) < 0.5;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-[10.5px] font-semibold ${
        flat
          ? "border-neutral-border bg-neutral-100 text-stone-light"
          : up
            ? "border-terracotta-600 bg-terracotta-100 text-terracotta-700"
            : "border-sage-border bg-sage-100 text-sage-700"
      }`}
      title={`${comparison.previousMonth}: mismo cálculo del mes anterior`}
    >
      {flat ? "≈" : up ? "▲" : "▼"} {Math.abs(comparison.deltaPct).toFixed(0)}% vs. mes anterior
    </span>
  );
}
