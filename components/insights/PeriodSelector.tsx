"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { label: "Últimos 30 días", value: "30d" },
  { label: "Todo el mes anterior", value: "prev-month" },
  { label: "Últimos 3 meses", value: "3" },
  { label: "Últimos 6 meses", value: "6" },
  { label: "Todo", value: "all" },
  { label: "Mes específico…", value: "month" },
];

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Rango fijo alrededor del año actual — de sobra para el histórico de Calfi
// (arranca en 2026) y para el año que viene, sin depender de una consulta al
// server para saber el rango real de datos.
function yearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year++) years.push(year);
  return years;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PeriodSelector({ basePath = "/insights" }: { basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodParam = searchParams.get("period") ?? "all";
  const isSpecificMonth = periodParam.startsWith("month:");
  const current = isSpecificMonth ? "month" : periodParam;
  const monthValue = isSpecificMonth ? periodParam.slice("month:".length) : "";
  const [selectedYear, selectedMonth] = monthValue ? monthValue.split("-") : ["", ""];

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`${basePath}?${params.toString()}`);
  }

  function handleSelectChange(value: string) {
    if (value === "month") {
      // Al pasar a "Mes específico" siempre navegamos ya mismo (con el mes
      // elegido antes, o el mes actual como default) — así el select y la URL
      // nunca quedan desincronizados esperando que el usuario toque los
      // selects de al lado.
      setPeriod(`month:${monthValue || currentYearMonth()}`);
      return;
    }
    setPeriod(value);
  }

  function handleYearChange(year: string) {
    const month = selectedMonth || currentYearMonth().split("-")[1];
    setPeriod(`month:${year}-${month}`);
  }

  function handleMonthChange(month: string) {
    const year = selectedYear || currentYearMonth().split("-")[0];
    setPeriod(`month:${year}-${month}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={current}
        onChange={(event) => handleSelectChange(event.target.value)}
        className="rounded-control border-[1.5px] border-border px-3 py-1.5 text-[11.5px] font-medium text-ink-muted"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {current === "month" && (
        <>
          <select
            value={selectedMonth}
            onChange={(event) => handleMonthChange(event.target.value)}
            className="rounded-control border-[1.5px] border-border px-2 py-1.5 text-[11.5px] font-medium text-ink-muted"
          >
            {MONTH_NAMES.map((name, index) => {
              const value = String(index + 1).padStart(2, "0");
              return (
                <option key={value} value={value}>
                  {name}
                </option>
              );
            })}
          </select>
          <select
            value={selectedYear}
            onChange={(event) => handleYearChange(event.target.value)}
            className="rounded-control border-[1.5px] border-border px-2 py-1.5 text-[11.5px] font-medium text-ink-muted"
          >
            {yearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
