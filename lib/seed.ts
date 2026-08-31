import type Database from "better-sqlite3";

const DEFAULT_CATEGORIES: Array<{ name: string; type: "gasto" | "ingreso"; icon: string }> = [
  { name: "Comida", type: "gasto", icon: "🍔" },
  { name: "Servicios", type: "gasto", icon: "💡" },
  { name: "Ropa", type: "gasto", icon: "👕" },
  { name: "Transporte", type: "gasto", icon: "🚌" },
  { name: "Transferencias", type: "gasto", icon: "💸" },
  { name: "Ingresos", type: "ingreso", icon: "💰" },
  { name: "Otros", type: "gasto", icon: "📦" },
];

export function seedCategories(db: Database.Database): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO categories (name, type, icon) VALUES (@name, @type, @icon)"
  );
  const insertMany = db.transaction((rows: typeof DEFAULT_CATEGORIES) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(DEFAULT_CATEGORIES);
}
