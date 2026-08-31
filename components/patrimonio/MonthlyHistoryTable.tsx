import type { MonthlyHistory } from "@/lib/patrimonio";
import { formatMoney } from "@/lib/formatMoney";

export function MonthlyHistoryTable({
  history,
  currency = "ARS",
  usdFactor = 1,
}: {
  history: MonthlyHistory;
  currency?: "ARS" | "USD";
  usdFactor?: number;
}) {
  // Activos y deudas son tablas separadas con su propio autoincrement, así que
  // sus ids se pisan (ej. activo 2 y deuda 2) — hace falta prefijar para la key de React.
  const rows = [
    ...history.assets.map((row) => ({ ...row, rowKey: `asset-${row.id}` })),
    ...history.debts.map((row) => ({ ...row, rowKey: `debt-${row.id}` })),
  ];

  if (history.months.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-control border-[1.5px] border-dashed border-border-dashed p-4 text-center text-[11px] text-stone-faint">
        Todavía no hay historial mensual — se genera automáticamente cada vez que actualizás el
        valor de una cuenta.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-control border-[1.5px] border-border-dashed">
      <div
        className="grid gap-2 bg-cream-faint px-3.5 py-2 font-mono text-[9.5px] font-semibold text-stone-faint"
        style={{ gridTemplateColumns: `1.5fr repeat(${history.months.length}, 1fr)` }}
      >
        <span>CUENTA</span>
        {history.months.map((month) => (
          <span key={month} className="text-right">
            {month}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.rowKey}
          className="grid items-center gap-2 border-t border-hairline px-3.5 py-2"
          style={{ gridTemplateColumns: `1.5fr repeat(${history.months.length}, 1fr)` }}
        >
          <span className="text-xs font-medium text-ink">{row.name}</span>
          {history.months.map((month) => (
            <span key={month} className="text-right font-mono text-[11px] text-stone-light">
              {row.valuesByMonth[month] !== undefined
                ? formatMoney(row.valuesByMonth[month] * usdFactor, currency)
                : "—"}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
