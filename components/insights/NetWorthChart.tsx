"use client";

import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { NetWorthProjectionPoint } from "@/lib/insights";
import { SAGE } from "@/components/insights/chartColors";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

export function NetWorthChart({ data }: { data: NetWorthProjectionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[11px] text-stone-faint">
        Todavía no hay historial de patrimonio — se genera al cargar activos/deudas en Patrimonio.
      </p>
    );
  }

  const hasProjection = data.some((point) => point.projected !== null);
  const hasEstimate = data.some((point) => point.estimatedNetWorth !== null);

  return (
    <div className="h-[130px]">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: "#a5a196" }}
          />
          <Tooltip
            formatter={(value) => `$${formatAmount(Number(value))}`}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke={SAGE}
            strokeWidth={2}
            fill={SAGE}
            fillOpacity={0.15}
            connectNulls={false}
          />
          {hasEstimate && (
            <Line
              type="monotone"
              dataKey="estimatedNetWorth"
              stroke={SAGE}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              name="Estimado (a partir del flujo de caja)"
            />
          )}
          {hasProjection && (
            <Line
              type="monotone"
              dataKey="projected"
              stroke={SAGE}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              name="Proyectado (tendencia simple)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
