CREATE TABLE IF NOT EXISTS planned_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes TEXT,
  estimated_amount REAL,
  category_id INTEGER REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'Pendiente',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  purchased_at TEXT
);
