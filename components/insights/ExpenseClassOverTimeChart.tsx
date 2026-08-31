"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { ExpenseClassMonthly } from "@/lib/insights";
import { SAGE, AMBER, TERRACOTTA } from "@/components/insights/chartColors";
import { formatMoney } from "@/lib/formatMoney";

export function ExpenseClassOverTimeChart({
  data,
  currency = "ARS",
}: {
  data: ExpenseClassMonthly[];
  currency?: "ARS" | "USD";
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin gastos en el período.</p>;
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-3 text-[10px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: SAGE }} /> Fijo
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: AMBER }} /> Variable
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: TERRACOTTA }} /> Extraordinario
        </span>
      </div>
      <div className="h-[130px]">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#a5a196" }}
            />
            <Tooltip
              formatter={(value) => formatMoney(Number(value), currency)}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Bar dataKey="Fijo" stackId="a" fill={SAGE} />
            <Bar dataKey="Variable" stackId="a" fill={AMBER} />
            <Bar dataKey="Extraordinario" stackId="a" fill={TERRACOTTA} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
