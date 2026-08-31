"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { CategoryMonthlySubcategory } from "@/lib/insights";
import { SAGE } from "@/components/insights/chartColors";
import { formatMoney } from "@/lib/formatMoney";

// Mismo verde de marca que ya usaba el gráfico de barra única (MonthlySpendingChart) —
// las subcategorías se distinguen por opacidad, no por una paleta de colores nueva,
// para mantener el estilo monocromático del resto de los gráficos de esta pantalla.
const OPACITY_STEPS = [1, 0.78, 0.6, 0.46, 0.35, 0.27];

function opacityFor(index: number): number {
  return OPACITY_STEPS[index % OPACITY_STEPS.length];
}

/** Primer y último día del mes "YYYY-MM", para filtrar Movimientos al clickear una barra. */
function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function CategoryMonthlyStackedChart({
  data,
  subcategories,
  currency = "ARS",
  basePath,
}: {
  data: CategoryMonthlySubcategory[];
  subcategories: string[];
  currency?: "ARS" | "USD";
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (data.length === 0) {
    return <p className="py-8 text-center text-[11px] text-stone-faint">Sin gastos en el período.</p>;
  }

  function handleBarClick(month: string | undefined) {
    if (!month) return;
    const { from, to } = monthRange(month);
    const params = new URLSearchParams(searchParams.toString());
    params.set("dateFrom", from);
    params.set("dateTo", to);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <>
      {subcategories.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-soft">
          {subcategories.map((name, index) => (
            <span key={name} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: SAGE, opacity: opacityFor(index) }}
              />
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="h-[130px] cursor-pointer">
        <ResponsiveContainer>
          <BarChart
            data={data}
            onClick={(state) => handleBarClick(state?.activeLabel as string | undefined)}
          >
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#a5a196" }}
            />
            <Tooltip
              formatter={(value) => formatMoney(Number(value), currency)}
              itemSorter={(item) => -(Number(item.value) || 0)}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            {subcategories.map((name, index) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="a"
                fill={SAGE}
                fillOpacity={opacityFor(index)}
                maxBarSize={28}
                radius={index === subcategories.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[9.5px] text-stone-faint">Clickeá una barra para filtrar Movimientos por ese mes.</p>
    </>
  );
}
