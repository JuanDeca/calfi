"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SAGE, AMBER, NEUTRAL_GRAY } from "@/components/insights/chartColors";
import type { AuditCounts } from "@/lib/auditoria";

export function ImpactDonutChart({ counts }: { counts: AuditCounts }) {
  const data = [
    { name: "Impacta Sí", value: counts.impactaSi, color: SAGE },
    { name: "Impacta No", value: counts.impactaNo, color: NEUTRAL_GRAY },
    { name: "Pendiente", value: counts.pendiente, color: AMBER },
  ].filter((entry) => entry.value > 0);

  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin movimientos todavía.</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-[120px] w-[120px] flex-none">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={58} strokeWidth={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: entry.color }} />
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="font-mono text-stone-light">
              {((entry.value / counts.total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
