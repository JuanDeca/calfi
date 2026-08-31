"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AMBER, INK_SOFT } from "@/components/insights/chartColors";
import type { MonthlyDataQuality } from "@/lib/auditoria";

export function DataQualityTrendChart({ data }: { data: MonthlyDataQuality[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin historial todavía.</p>;
  }

  return (
    <div className="h-[150px]">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#a5a196" }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="pendiente" name="Pendiente" fill={AMBER} radius={[3, 3, 0, 0]} />
          <Bar dataKey="sinCategoria" name="Sin categoría" fill={INK_SOFT} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
