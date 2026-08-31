const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

let cached: { rate: number; fetchedAt: number } | null = null;

export interface UsdRate {
  rate: number;
  updatedAt: string;
}

/** Cotización del dólar blue (venta) desde dolarapi.com. Devuelve null si no hay
 * conexión o la API falla — el caller decide cómo degradar (ej. deshabilitar USD). */
export async function getUsdRate(): Promise<UsdRate | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, updatedAt: new Date(cached.fetchedAt).toISOString() };
  }

  try {
    const response = await fetch("https://dolarapi.com/v1/dolares/blue", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { venta: number };
    cached = { rate: data.venta, fetchedAt: Date.now() };
    return { rate: data.venta, updatedAt: new Date(cached.fetchedAt).toISOString() };
  } catch {
    return null;
  }
}
