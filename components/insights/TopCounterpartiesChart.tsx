import type { TopCounterparty } from "@/lib/insights";
import { SAGE } from "@/components/insights/chartColors";
import { formatMoney } from "@/lib/formatMoney";

export function TopCounterpartiesChart({
  data,
  currency = "ARS",
}: {
  data: TopCounterparty[];
  currency?: "ARS" | "USD";
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin gastos en el período.</p>;
  }

  const max = Math.max(...data.map((item) => item.total));

  return (
    <div className="flex flex-col gap-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center gap-2.5">
          <span className="w-4 flex-none text-right font-mono text-[10px] text-stone-faint">
            {index + 1}
          </span>
          <span className="w-[120px] flex-none truncate text-[11px] font-medium text-ink-soft" title={item.name}>
            {item.name}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-hairline">
            <div
              className="h-full rounded"
              style={{ width: `${(item.total / max) * 100}%`, background: SAGE }}
            />
          </div>
          <span className="w-9 flex-none text-right font-mono text-[10px] text-stone-faint">
            ×{item.count}
          </span>
          <span className="w-20 flex-none text-right font-mono text-[11px] font-semibold text-ink-muted">
            {formatMoney(item.total, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}
