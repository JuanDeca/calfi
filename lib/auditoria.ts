import { db } from "@/lib/db";

export interface AuditCounts {
  total: number;
  impactaSi: number;
  impactaNo: number;
  pendiente: number;
  sinCategoria: number;
  desglosadas: number;
}

export function getAuditCounts(): AuditCounts {
  const counts = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN impacts_analysis = 'Sí' THEN 1 ELSE 0 END) AS impactaSi,
        SUM(CASE WHEN impacts_analysis = 'No' THEN 1 ELSE 0 END) AS impactaNo,
        SUM(CASE WHEN impacts_analysis = 'Pendiente' THEN 1 ELSE 0 END) AS pendiente,
        SUM(CASE WHEN category_id IS NULL THEN 1 ELSE 0 END) AS sinCategoria
      FROM transactions
    `
    )
    .get() as Omit<AuditCounts, "desglosadas">;

  const { count: desglosadas } = db
    .prepare(
      "SELECT COUNT(DISTINCT parent_transaction_id) AS count FROM transactions WHERE parent_transaction_id IS NOT NULL"
    )
    .get() as { count: number };

  return { ...counts, desglosadas };
}

export interface MonthlyDataQuality {
  month: string;
  pendiente: number;
  sinCategoria: number;
}

export function getMonthlyDataQuality(): MonthlyDataQuality[] {
  return db
    .prepare(
      `
      SELECT
        strftime('%Y-%m', date) AS month,
        SUM(CASE WHEN impacts_analysis = 'Pendiente' THEN 1 ELSE 0 END) AS pendiente,
        SUM(CASE WHEN category_id IS NULL THEN 1 ELSE 0 END) AS sinCategoria
      FROM transactions
      GROUP BY month
      ORDER BY month ASC
    `
    )
    .all() as MonthlyDataQuality[];
}
