"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { MonthlyIncomeExpense } from "@/lib/insights";
import { SAGE, TERRACOTTA } from "@/components/insights/chartColors";
import { formatMoney } from "@/lib/formatMoney";

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  currency: "ARS" | "USD";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const income = payload.find((entry) => entry.dataKey === "income")?.value ?? 0;
  const expense = payload.find((entry) => entry.dataKey === "expense")?.value ?? 0;
  const savings = income - expense;

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-[11px] shadow-card">
      <div className="mb-1 font-semibold text-ink-soft">{label}</div>
      <div style={{ color: SAGE }}>Ingresos: {formatMoney(income, currency)}</div>
      <div style={{ color: TERRACOTTA }}>Egresos: {formatMoney(expense, currency)}</div>
      <div className="mt-1 border-t border-dashed border-border-dashed pt-1 font-semibold text-ink">
        Ahorro: {formatMoney(savings, currency)}
      </div>
    </div>
  );
}

export function IncomeExpenseChart({
  data,
  currency = "ARS",
}: {
  data: MonthlyIncomeExpense[];
  currency?: "ARS" | "USD";
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin datos en el período.</p>;
  }

  const totalSavings = data.reduce((sum, row) => sum + (row.income - row.expense), 0);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] text-ink-soft">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SAGE }} /> Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TERRACOTTA }} /> Egresos
          </span>
        </div>
        <span className="text-[11px] font-semibold text-ink-soft">
          Ahorro del período: <span className="text-sage-700">{formatMoney(totalSavings, currency)}</span>
        </span>
      </div>
      <div className="h-[110px]">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#a5a196" }}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Bar dataKey="income" fill={SAGE} radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expense" fill={TERRACOTTA} radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
