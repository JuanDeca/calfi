import type { DistributionItem } from "@/lib/insights";
import { SAGE, TERRACOTTA } from "@/components/insights/chartColors";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

export function DistributionChart({ data }: { data: DistributionItem[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[11px] text-stone-faint">
        Todavía no cargaste activos ni deudas en Patrimonio.
      </p>
    );
  }

  const max = Math.max(...data.map((item) => item.value));

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item) => (
        <div key={`${item.kind}-${item.name}`}>
          <div className="mb-1 flex justify-between text-[10.5px] text-ink-soft">
            <span>{item.name}</span>
            <span className="font-mono">${formatAmount(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-hairline">
            <div
              className="h-full rounded"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: item.kind === "asset" ? SAGE : TERRACOTTA,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
