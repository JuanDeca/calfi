CREATE TABLE IF NOT EXISTS recurring_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  default_amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  subcategory TEXT,
  expense_class TEXT NOT NULL DEFAULT 'Fijo' CHECK (expense_class IN ('Fijo', 'Variable', 'Extraordinario', 'No aplica')),
  impacts_analysis TEXT NOT NULL DEFAULT 'Sí' CHECK (impacts_analysis IN ('Sí', 'No')),
  frequency TEXT NOT NULL CHECK (frequency IN ('mensual', 'anual')),
  day_of_month INTEGER NOT NULL DEFAULT 1,
  month_of_year INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
