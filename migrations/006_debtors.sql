CREATE TABLE IF NOT EXISTS debtors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debtor_debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debtor_id INTEGER NOT NULL REFERENCES debtors(id),
  concept TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Pagado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
