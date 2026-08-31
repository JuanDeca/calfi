import { db, mutate } from "@/lib/db";

export interface Category {
  id: number;
  name: string;
  type: "gasto" | "ingreso";
  excludedFromAnalysis: boolean;
  icon: string;
  // Si se setea, cada transacción categorizada acá suma su monto al valor de
  // este activo de Patrimonio automáticamente (ver bumpAssetValue en lib/patrimonio.ts) —
  // pensado para categorías tipo "Inversiones" que representan plata que se mueve
  // a una cuenta/activo propio, no un gasto real.
  linkedAssetId: number | null;
}

interface CategoryRow {
  id: number;
  name: string;
  type: "gasto" | "ingreso";
  excluded_from_analysis: number;
  icon: string;
  linked_asset_id: number | null;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    excludedFromAnalysis: row.excluded_from_analysis === 1,
    icon: row.icon,
    linkedAssetId: row.linked_asset_id,
  };
}

const CATEGORY_COLUMNS = "id, name, type, excluded_from_analysis, icon, linked_asset_id";

export function getCategories(): Category[] {
  const rows = db
    .prepare(`SELECT ${CATEGORY_COLUMNS} FROM categories ORDER BY name`)
    .all() as CategoryRow[];
  return rows.map(toCategory);
}

/** Cantidad de transacciones por categoría — usado como "tamaño" para ordenar `/categorias`. */
export function getCategoryTransactionCounts(): Record<number, number> {
  const rows = db
    .prepare(
      "SELECT category_id AS categoryId, COUNT(*) AS count FROM transactions WHERE category_id IS NOT NULL GROUP BY category_id"
    )
    .all() as { categoryId: number; count: number }[];
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.count]));
}

export function getCategoryById(id: number): Category | null {
  const row = db
    .prepare(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`)
    .get(id) as CategoryRow | undefined;
  return row ? toCategory(row) : null;
}

export function createCategory(
  name: string,
  type: "gasto" | "ingreso",
  excludedFromAnalysis = false,
  icon = "🏷️"
): void {
  mutate((connection) => {
    connection
      .prepare("INSERT INTO categories (name, type, excluded_from_analysis, icon) VALUES (?, ?, ?, ?)")
      .run(name, type, excludedFromAnalysis ? 1 : 0, icon);
  });
}

export function setCategoryExcludedFromAnalysis(id: number, excluded: boolean): void {
  mutate((connection) => {
    connection
      .prepare("UPDATE categories SET excluded_from_analysis = ? WHERE id = ?")
      .run(excluded ? 1 : 0, id);
  });
}

export function setCategoryIcon(id: number, icon: string): void {
  mutate((connection) => {
    connection.prepare("UPDATE categories SET icon = ? WHERE id = ?").run(icon, id);
  });
}

export function setCategoryLinkedAsset(id: number, assetId: number | null): void {
  mutate((connection) => {
    connection.prepare("UPDATE categories SET linked_asset_id = ? WHERE id = ?").run(assetId, id);
  });
}

/** Lookup liviano para los hooks de auto-actualización de Patrimonio — evita traer la categoría entera. */
export function getCategoryLinkedAssetId(categoryId: number | null): number | null {
  if (categoryId === null) return null;
  const row = db
    .prepare("SELECT linked_asset_id FROM categories WHERE id = ?")
    .get(categoryId) as { linked_asset_id: number | null } | undefined;
  return row?.linked_asset_id ?? null;
}

export function isCategoryExcludedFromAnalysis(categoryId: number | null): boolean {
  if (categoryId === null) return false;
  const row = db
    .prepare("SELECT excluded_from_analysis FROM categories WHERE id = ?")
    .get(categoryId) as { excluded_from_analysis: number } | undefined;
  return row?.excluded_from_analysis === 1;
}

export function deleteCategory(id: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM categories WHERE id = ?").run(id);
  });
}

export interface CategorizationRuleSummary {
  counterpartyKey: string;
  categoryId: number | null;
  categoryName: string | null;
  subcategory: string | null;
  expenseClass: string;
  impactsAnalysis: string;
}

export function getCategorizationRules(): CategorizationRuleSummary[] {
  const rows = db
    .prepare(
      `
      SELECT r.counterparty_key AS counterpartyKey, r.category_id AS categoryId, c.name AS categoryName,
        r.subcategory, r.expense_class AS expenseClass, r.impacts_analysis AS impactsAnalysis
      FROM categorization_rules r
      LEFT JOIN categories c ON c.id = r.category_id
      ORDER BY r.counterparty_key
    `
    )
    .all() as CategorizationRuleSummary[];
  return rows;
}

export function getSubcategoriesForCategory(categoryId: number): string[] {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT subcategory FROM (
        SELECT subcategory FROM transactions WHERE category_id = ? AND subcategory IS NOT NULL AND TRIM(subcategory) != ''
        UNION
        SELECT subcategory FROM categorization_rules WHERE category_id = ? AND subcategory IS NOT NULL AND TRIM(subcategory) != ''
      )
      ORDER BY subcategory
    `
    )
    .all(categoryId, categoryId) as { subcategory: string }[];
  return rows.map((row) => row.subcategory);
}

export function mergeSubcategories(categoryId: number, from: string, to: string): number {
  return mutate((connection) => {
    const { changes } = connection
      .prepare(
        "UPDATE transactions SET subcategory = ? WHERE category_id = ? AND subcategory = ?"
      )
      .run(to, categoryId, from);
    connection
      .prepare(
        "UPDATE categorization_rules SET subcategory = ? WHERE category_id = ? AND subcategory = ?"
      )
      .run(to, categoryId, from);
    return changes;
  });
}

export function deleteCategorizationRule(counterpartyKey: string): void {
  mutate((connection) => {
    connection
      .prepare("DELETE FROM categorization_rules WHERE counterparty_key = ?")
      .run(counterpartyKey);
  });
}
