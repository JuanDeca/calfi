"use client";

import { useState } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategorySpending } from "@/lib/insights";
import { CATEGORY_COLORS, NEUTRAL_GRAY } from "@/components/insights/chartColors";
import { formatMoney } from "@/lib/formatMoney";

interface Slice {
  name: string;
  total: number;
  categoryId: number | null;
  fill: string;
  fillOpacity: number;
}

/** Rampa de opacidad sobre el mismo gris — "Otros" no es una categoría real,
 * así que sus partes se distinguen por opacidad en vez de tomar cada una un
 * color categórico propio (evita fabricar más tokens de color de los que el
 * top 7 ya usa). */
function opacityFor(index: number, count: number): number {
  if (count <= 1) return 1;
  return 1 - (index / (count - 1)) * 0.75;
}

export function CategoryPieChart({
  data,
  currency = "ARS",
}: {
  data: CategorySpending[];
  currency?: "ARS" | "USD";
}) {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin gastos en el período.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.total, 0);
  const otros = data.find((row) => row.breakdown);

  const topSlices: Slice[] = data
    .filter((row) => !row.breakdown)
    .map((row, index) => ({
      name: row.name,
      total: row.total,
      categoryId: row.categoryId,
      fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      fillOpacity: 1,
    }));

  const otrosSlices: Slice[] = !otros
    ? []
    : expanded
      ? otros.breakdown!.map((sub, index) => ({
          name: sub.name,
          total: sub.total,
          categoryId: sub.categoryId,
          fill: NEUTRAL_GRAY,
          fillOpacity: opacityFor(index, otros.breakdown!.length),
        }))
      : [{ name: otros.name, total: otros.total, categoryId: null, fill: NEUTRAL_GRAY, fillOpacity: 1 }];

  const pieSlices = [...topSlices, ...otrosSlices];
  const max = Math.max(...pieSlices.map((slice) => slice.total));

  return (
    <div className="flex flex-col items-center gap-5 md:flex-row">
      <div className="h-[190px] w-[190px] flex-none">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieSlices}
              dataKey="total"
              nameKey="name"
              innerRadius={52}
              outerRadius={92}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {pieSlices.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} fillOpacity={slice.fillOpacity} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(Number(value), currency)}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex w-full flex-1 flex-col gap-2.5">
        {topSlices.map((slice) => (
          <div key={slice.name} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: slice.fill }} />
            {slice.categoryId !== null ? (
              <Link
                href={`/insights/categoria/${slice.categoryId}`}
                className="w-36 flex-none truncate text-[12.5px] font-medium text-ink-soft hover:text-sage-700 hover:underline"
              >
                {slice.name}
              </Link>
            ) : (
              <span className="w-36 flex-none truncate text-[12.5px] font-medium text-ink-soft">
                {slice.name}
              </span>
            )}
            <div className="h-3.5 flex-1 overflow-hidden rounded bg-hairline">
              <div
                className="h-full rounded"
                style={{ width: `${(slice.total / max) * 100}%`, background: slice.fill }}
              />
            </div>
            <span className="w-24 flex-none text-right font-mono text-[11.5px] font-semibold text-ink-muted">
              {formatMoney(slice.total, currency)}
            </span>
            <span className="w-9 flex-none text-right font-mono text-[10.5px] text-stone-light">
              {((slice.total / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}

        {otros && (
          <div className="border-t border-dashed border-border-dashed pt-2">
            {!expanded && (
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: NEUTRAL_GRAY }} />
                <span className="w-36 flex-none truncate text-[12.5px] font-medium text-ink-soft">
                  {otros.name}
                </span>
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-hairline">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(otros.total / max) * 100}%`, background: NEUTRAL_GRAY }}
                  />
                </div>
                <span className="w-24 flex-none text-right font-mono text-[11.5px] font-semibold text-ink-muted">
                  {formatMoney(otros.total, currency)}
                </span>
                <span className="w-9 flex-none text-right font-mono text-[10.5px] text-stone-light">
                  {((otros.total / total) * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {expanded &&
              otrosSlices.map((slice) => (
                <div key={slice.name} className="mb-1.5 flex items-center gap-2.5 last:mb-0">
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: slice.fill, opacity: slice.fillOpacity }}
                  />
                  {slice.categoryId !== null ? (
                    <Link
                      href={`/insights/categoria/${slice.categoryId}`}
                      className="w-36 flex-none truncate text-[12.5px] font-medium text-ink-soft hover:text-sage-700 hover:underline"
                    >
                      {slice.name}
                    </Link>
                  ) : (
                    <span className="w-36 flex-none truncate text-[12.5px] font-medium text-ink-soft">
                      {slice.name}
                    </span>
                  )}
                  <div className="h-3.5 flex-1 overflow-hidden rounded bg-hairline">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(slice.total / max) * 100}%`,
                        background: slice.fill,
                        opacity: slice.fillOpacity,
                      }}
                    />
                  </div>
                  <span className="w-24 flex-none text-right font-mono text-[11.5px] font-semibold text-ink-muted">
                    {formatMoney(slice.total, currency)}
                  </span>
                  <span className="w-9 flex-none text-right font-mono text-[10.5px] text-stone-light">
                    {((slice.total / total) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}

            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-1.5 text-[10.5px] font-semibold text-sage-700 hover:underline"
            >
              {expanded ? "Ocultar desglose de Otros ▴" : "Ver desglose de Otros ▾"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
