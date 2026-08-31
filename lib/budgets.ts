import { db, mutate } from "@/lib/db";

export interface CategoryBudget {
  categoryId: number;
  categoryName: string;
  monthlyLimit: number;
  active: boolean;
}

export function getBudgetForCategory(categoryId: number): CategoryBudget | null {
  const row = db
    .prepare(
      `
      SELECT b.category_id AS categoryId, c.name AS categoryName, b.monthly_limit AS monthlyLimit, b.active
      FROM category_budgets b JOIN categories c ON c.id = b.category_id
      WHERE b.category_id = ?
    `
    )
    .get(categoryId) as (Omit<CategoryBudget, "active"> & { active: number }) | undefined;
  if (!row) return null;
  return { ...row, active: row.active === 1 };
}

export function getBudgets(): CategoryBudget[] {
  const rows = db
    .prepare(
      `
      SELECT b.category_id AS categoryId, c.name AS categoryName, b.monthly_limit AS monthlyLimit, b.active
      FROM category_budgets b JOIN categories c ON c.id = b.category_id
      WHERE b.active = 1
      ORDER BY c.name
    `
    )
    .all() as (Omit<CategoryBudget, "active"> & { active: number })[];
  return rows.map((row) => ({ ...row, active: row.active === 1 }));
}

export function setBudget(categoryId: number, monthlyLimit: number): void {
  mutate((connection) => {
    connection
      .prepare(
        `
        INSERT INTO category_budgets (category_id, monthly_limit)
        VALUES (?, ?)
        ON CONFLICT(category_id) DO UPDATE SET monthly_limit = excluded.monthly_limit, active = 1, updated_at = datetime('now')
      `
      )
      .run(categoryId, monthlyLimit);
  });
}

export function deleteBudget(categoryId: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM category_budgets WHERE category_id = ?").run(categoryId);
  });
}

export interface BudgetStatus extends CategoryBudget {
  spentThisMonth: number;
  overBudget: boolean;
}

export function getCurrentMonthSpendingForCategory(categoryId: number): number {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { total } = db
    .prepare(
      `
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM transactions
      WHERE impacts_analysis = 'Sí' AND amount < 0 AND category_id = ?
        AND strftime('%Y-%m', date) = ?
    `
    )
    .get(categoryId, currentMonth) as { total: number };
  return total;
}

/** Categorías con presupuesto activo, comparadas contra el gasto real del mes calendario en curso. */
export function getBudgetStatuses(): BudgetStatus[] {
  return getBudgets().map((budget) => {
    const total = getCurrentMonthSpendingForCategory(budget.categoryId);
    return { ...budget, spentThisMonth: total, overBudget: total > budget.monthlyLimit };
  });
}
