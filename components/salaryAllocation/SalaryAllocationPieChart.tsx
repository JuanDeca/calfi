"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BucketWithBalance } from "@/lib/salaryAllocation";
import { CATEGORY_COLORS, NEUTRAL_GRAY } from "@/components/insights/chartColors";

interface Slice {
  name: string;
  percentage: number;
  fill: string;
}

export function SalaryAllocationPieChart({ buckets }: { buckets: BucketWithBalance[] }) {
  const activeBuckets = buckets.filter((bucket) => bucket.percentage !== null && bucket.active);
  const assigned = activeBuckets.reduce((sum, bucket) => sum + (bucket.percentage as number), 0);
  const resto = Math.max(0, 100 - assigned);

  const slices: Slice[] = [
    ...activeBuckets.map((bucket, index) => ({
      name: bucket.label,
      percentage: bucket.percentage as number,
      fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    })),
    { name: "Resto (día a día)", percentage: resto, fill: NEUTRAL_GRAY },
  ];

  return (
    <div className="flex flex-col items-center gap-5 md:flex-row">
      <div className="h-[190px] w-[190px] flex-none">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="percentage"
              nameKey="name"
              innerRadius={52}
              outerRadius={92}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${value}%`}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex w-full flex-1 flex-col gap-2">
        {slices.map((slice) => (
          <div key={slice.name} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: slice.fill }} />
            <span className="flex-1 truncate text-[12.5px] font-medium text-ink-soft">{slice.name}</span>
            <span className="w-11 flex-none text-right font-mono text-[12px] font-semibold text-ink-muted">
              {slice.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
