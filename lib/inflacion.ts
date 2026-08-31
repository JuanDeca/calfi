const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el IPC se publica una vez por mes

interface InflationEntry {
  fecha: string; // "YYYY-MM-DD"
  valor: number; // variación mensual en %
}

export interface InflationIndex {
  /** índice acumulado por mes ("YYYY-MM" -> índice base 100 en el primer mes disponible) */
  indexByMonth: Map<string, number>;
  /** mes más reciente publicado — es el mes "de referencia" al que se ajustan los demás */
  referenceMonth: string;
}

let cached: { index: InflationIndex; fetchedAt: number } | null = null;

export async function getInflationIndex(): Promise<InflationIndex | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.index;
  }

  try {
    const response = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as InflationEntry[];
    if (data.length === 0) return null;

    // Solo hace falta historia reciente: la comparación siempre es relativa
    // entre dos meses dentro de la ventana, no contra 1943.
    const recent = data.slice(-36);

    const indexByMonth = new Map<string, number>();
    let index = 100;
    for (const entry of recent) {
      const month = entry.fecha.slice(0, 7);
      index *= 1 + entry.valor / 100;
      indexByMonth.set(month, index);
    }

    const referenceMonth = recent[recent.length - 1].fecha.slice(0, 7);
    const result: InflationIndex = { indexByMonth, referenceMonth };
    cached = { index: result, fetchedAt: Date.now() };
    return result;
  } catch {
    return null;
  }
}

/** Factor por el que hay que multiplicar un monto de `month` para expresarlo
 * en pesos del mes de referencia (el más reciente publicado). */
export function getAdjustmentFactor(index: InflationIndex, month: string): number {
  const monthIndex = index.indexByMonth.get(month);
  const referenceIndex = index.indexByMonth.get(index.referenceMonth);
  if (!monthIndex || !referenceIndex) return 1;
  return referenceIndex / monthIndex;
}
