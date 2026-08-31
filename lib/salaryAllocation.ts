import { db, mutate } from "@/lib/db";

export interface SubAllocation {
  label: string;
  percentage: number;
}

export interface SalaryAllocationBucket {
  id: number;
  key: string;
  label: string;
  percentage: number | null;
  activeMonths: number[] | null;
  pocketKeywords: string[] | null;
  destinationNote: string | null;
  subAllocations: SubAllocation[] | null;
  sortOrder: number;
}

interface BucketRow {
  id: number;
  key: string;
  label: string;
  percentage: number | null;
  active_months: string | null;
  pocket_keywords: string | null;
  destination_note: string | null;
  sub_allocations: string | null;
  sort_order: number;
}

function toBucket(row: BucketRow): SalaryAllocationBucket {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    percentage: row.percentage,
    activeMonths: row.active_months ? row.active_months.split(",").map(Number) : null,
    pocketKeywords: row.pocket_keywords ? (JSON.parse(row.pocket_keywords) as string[]) : null,
    destinationNote: row.destination_note,
    subAllocations: row.sub_allocations ? (JSON.parse(row.sub_allocations) as SubAllocation[]) : null,
    sortOrder: row.sort_order,
  };
}

export function getSalaryAllocationBuckets(): SalaryAllocationBucket[] {
  const rows = db
    .prepare("SELECT * FROM salary_allocation_buckets ORDER BY sort_order")
    .all() as BucketRow[];
  return rows.map(toBucket);
}

export function isBucketActive(bucket: SalaryAllocationBucket, now: Date): boolean {
  if (!bucket.activeMonths) return true;
  return bucket.activeMonths.includes(now.getMonth() + 1);
}

/** Saldo en vivo de un pocket de MP, calculado directo de `transactions` (nunca un ledger sintético). */
export function getPocketBalance(keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const conditions = keywords
    .map(() => "(description LIKE 'Dinero reservado ' || ? || '%' OR description LIKE 'Dinero retirado ' || ? || '%')")
    .join(" OR ");
  const params = keywords.flatMap((keyword) => [keyword, keyword]);
  const row = db
    .prepare(`SELECT COALESCE(SUM(-amount), 0) AS balance FROM transactions WHERE ${conditions}`)
    .get(...params) as { balance: number };
  return row.balance;
}

/** Fecha del movimiento más reciente que matchea el pocket — para poder distinguir
 * un saldo activo de uno "congelado" hace meses sin tener que preguntar por qué. */
export function getPocketLastActivity(keywords: string[]): string | null {
  if (keywords.length === 0) return null;
  const conditions = keywords
    .map(() => "(description LIKE 'Dinero reservado ' || ? || '%' OR description LIKE 'Dinero retirado ' || ? || '%')")
    .join(" OR ");
  const params = keywords.flatMap((keyword) => [keyword, keyword]);
  const row = db
    .prepare(`SELECT MAX(date) AS lastDate FROM transactions WHERE ${conditions}`)
    .get(...params) as { lastDate: string | null };
  return row.lastDate;
}

// La plata parada en un pocket de MP gana su propio rendimiento, invisible en
// cualquier transacción que Calfi pueda ver — por eso el saldo por patrón
// siempre queda corto, más cuanto más vieja sea la última actividad. Cuando
// Juan confirma el saldo real, se guarda acá junto con la tasa diaria
// implícita desde la referencia anterior, para poder proyectar una
// estimación hacia adelante hasta la próxima confirmación.
export interface PocketConfirmation {
  bucketKey: string;
  confirmedBalance: number;
  dailyRate: number;
  confirmedAt: string;
}

interface ConfirmationRow {
  bucket_key: string;
  confirmed_balance: number;
  daily_rate: number;
  confirmed_at: string;
}

function toConfirmation(row: ConfirmationRow): PocketConfirmation {
  return {
    bucketKey: row.bucket_key,
    confirmedBalance: row.confirmed_balance,
    dailyRate: row.daily_rate,
    confirmedAt: row.confirmed_at,
  };
}

export function getLatestConfirmation(bucketKey: string): PocketConfirmation | null {
  const row = db
    .prepare(
      "SELECT * FROM salary_allocation_confirmations WHERE bucket_key = ? ORDER BY confirmed_at DESC, id DESC LIMIT 1"
    )
    .get(bucketKey) as ConfirmationRow | undefined;
  return row ? toConfirmation(row) : null;
}

function daysBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso.replace(" ", "T"));
  return (toDate.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

/** Actividad real del pocket (reservado/retirado) ocurrida DESPUÉS de una fecha
 * de referencia — se suma tal cual sobre la proyección de rendimiento, no se estima. */
function getPocketActivitySince(keywords: string[], sinceIso: string): number {
  if (keywords.length === 0) return 0;
  const conditions = keywords
    .map(() => "(description LIKE 'Dinero reservado ' || ? || '%' OR description LIKE 'Dinero retirado ' || ? || '%')")
    .join(" OR ");
  const params = keywords.flatMap((keyword) => [keyword, keyword]);
  const row = db
    .prepare(`SELECT COALESCE(SUM(-amount), 0) AS balance FROM transactions WHERE (${conditions}) AND date > ?`)
    .get(...params, sinceIso.slice(0, 10)) as { balance: number };
  return row.balance;
}

export function recordPocketConfirmation(bucketKey: string, confirmedBalance: number, now = new Date()): void {
  const bucket = getSalaryAllocationBuckets().find((b) => b.key === bucketKey);
  const keywords = bucket?.pocketKeywords ?? [];
  const prior = getLatestConfirmation(bucketKey);

  const baseline = prior ? prior.confirmedBalance + getPocketActivitySince(keywords, prior.confirmedAt) : getPocketBalance(keywords);
  const sinceIso = prior ? prior.confirmedAt : (getPocketLastActivity(keywords) ?? now.toISOString());
  const days = daysBetween(sinceIso, now);
  const dailyRate = baseline > 0 && days > 0 ? (confirmedBalance / baseline) ** (1 / days) - 1 : 0;

  mutate((connection) => {
    connection
      .prepare(
        "INSERT INTO salary_allocation_confirmations (bucket_key, confirmed_balance, daily_rate) VALUES (?, ?, ?)"
      )
      .run(bucketKey, confirmedBalance, dailyRate);
  });
}

const RECONFIRMATION_DAYS = 90;

function getEstimatedPocketBalance(
  bucketKey: string,
  keywords: string[],
  now: Date
): { balance: number; confirmedAt: string | null; needsReconfirmation: boolean } {
  const confirmation = getLatestConfirmation(bucketKey);
  if (!confirmation) {
    return { balance: getPocketBalance(keywords), confirmedAt: null, needsReconfirmation: false };
  }
  const days = Math.max(daysBetween(confirmation.confirmedAt, now), 0);
  const projected = confirmation.confirmedBalance * (1 + confirmation.dailyRate) ** days;
  const activitySince = getPocketActivitySince(keywords, confirmation.confirmedAt);
  return {
    balance: projected + activitySince,
    confirmedAt: confirmation.confirmedAt,
    needsReconfirmation: days > RECONFIRMATION_DAYS,
  };
}

export interface BucketWithBalance extends SalaryAllocationBucket {
  pocketBalance: number | null;
  pocketLastActivity: string | null;
  pocketConfirmedAt: string | null;
  needsReconfirmation: boolean;
  active: boolean;
}

export function getBucketsWithBalances(now = new Date()): BucketWithBalance[] {
  return getSalaryAllocationBuckets().map((bucket) => {
    if (!bucket.pocketKeywords) {
      return {
        ...bucket,
        pocketBalance: null,
        pocketLastActivity: null,
        pocketConfirmedAt: null,
        needsReconfirmation: false,
        active: isBucketActive(bucket, now),
      };
    }
    const estimate = getEstimatedPocketBalance(bucket.key, bucket.pocketKeywords, now);
    return {
      ...bucket,
      pocketBalance: estimate.balance,
      pocketLastActivity: getPocketLastActivity(bucket.pocketKeywords),
      pocketConfirmedAt: estimate.confirmedAt,
      needsReconfirmation: estimate.needsReconfirmation,
      active: isBucketActive(bucket, now),
    };
  });
}

export function updateBucketPercentage(id: number, percentage: number): void {
  mutate((connection) => {
    connection
      .prepare("UPDATE salary_allocation_buckets SET percentage = ? WHERE id = ?")
      .run(percentage, id);
  });
}

export interface AllocationSubItem {
  label: string;
  amount: number;
}

export interface AllocationItem {
  key: string;
  label: string;
  amount: number;
  destinationNote: string | null;
  subItems: AllocationSubItem[] | null;
}

export interface AllocationBreakdown {
  items: AllocationItem[];
  resto: number;
  usdReplenishment: UsdReplenishment;
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface UsdReplenishmentItem {
  date: string;
  description: string;
  usdAmount: number;
}

export interface UsdReplenishment {
  monthLabel: string;
  totalUsd: number;
  items: UsdReplenishmentItem[];
}

/** Lo que hay que reponerle al colchón: el total de suscripciones en dólares
 * (`original_amount_usd`) que se cobraron el mes calendario anterior al de `now`. */
export function getPreviousMonthUsdReplenishment(now = new Date()): UsdReplenishment {
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prefix = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const rows = db
    .prepare(
      `SELECT date, description, original_amount_usd AS usdAmount FROM transactions
       WHERE original_amount_usd IS NOT NULL AND date LIKE ? ORDER BY date`
    )
    .all(`${prefix}-%`) as UsdReplenishmentItem[];
  const totalUsd = Math.round(rows.reduce((sum, row) => sum + row.usdAmount, 0) * 100) / 100;
  return { monthLabel: `${MONTH_NAMES[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`, totalUsd, items: rows };
}

export function computeAllocation(grossAmount: number, now = new Date()): AllocationBreakdown {
  const buckets = getSalaryAllocationBuckets().filter(
    (bucket) => bucket.percentage !== null && isBucketActive(bucket, now)
  );
  const items = buckets.map((bucket) => {
    const amount = Math.round((grossAmount * (bucket.percentage as number)) / 100);
    return {
      key: bucket.key,
      label: bucket.label,
      amount,
      destinationNote: bucket.destinationNote,
      subItems: bucket.subAllocations
        ? bucket.subAllocations.map((sub) => ({
            label: sub.label,
            amount: Math.round((amount * sub.percentage) / 100),
          }))
        : null,
    };
  });
  const resto = grossAmount - items.reduce((sum, item) => sum + item.amount, 0);
  return { items, resto, usdReplenishment: getPreviousMonthUsdReplenishment(now) };
}

export interface AllocationRun {
  id: number;
  grossAmount: number;
  breakdown: AllocationBreakdown;
  createdAt: string;
}

interface RunRow {
  id: number;
  gross_amount: number;
  breakdown_json: string;
  created_at: string;
}

function toRun(row: RunRow): AllocationRun {
  return {
    id: row.id,
    grossAmount: row.gross_amount,
    breakdown: JSON.parse(row.breakdown_json) as AllocationBreakdown,
    createdAt: row.created_at,
  };
}

export function recordAllocationRun(grossAmount: number, breakdown: AllocationBreakdown): number {
  return mutate((connection) => {
    const info = connection
      .prepare("INSERT INTO salary_allocation_runs (gross_amount, breakdown_json) VALUES (?, ?)")
      .run(grossAmount, JSON.stringify(breakdown));
    return Number(info.lastInsertRowid);
  });
}

export function getLastAllocationRun(): AllocationRun | null {
  const row = db
    .prepare("SELECT * FROM salary_allocation_runs ORDER BY created_at DESC, id DESC LIMIT 1")
    .get() as RunRow | undefined;
  return row ? toRun(row) : null;
}
