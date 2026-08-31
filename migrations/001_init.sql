CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('gasto', 'ingreso'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  month TEXT,
  description TEXT,
  treatment_note TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  mp_reference TEXT,
  amount REAL NOT NULL,
  running_balance REAL,
  category_id INTEGER REFERENCES categories(id),
  subcategory TEXT,
  confidence TEXT CHECK (confidence IN ('Alta', 'Media', 'Baja')),
  rule_reason TEXT,
  impacts_analysis TEXT NOT NULL DEFAULT 'Pendiente' CHECK (impacts_analysis IN ('Sí', 'No', 'Pendiente')),
  impact_type TEXT,
  impact_reason TEXT,
  analysis_amount REAL,
  expense_class TEXT NOT NULL DEFAULT 'No aplica' CHECK (expense_class IN ('Fijo', 'Variable', 'Extraordinario', 'No aplica')),
  event_id INTEGER REFERENCES events(id),
  parent_transaction_id INTEGER REFERENCES transactions(id),
  source_file TEXT,
  mp_raw_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorization_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counterparty_key TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES categories(id),
  subcategory TEXT,
  expense_class TEXT CHECK (expense_class IN ('Fijo', 'Variable', 'Extraordinario', 'No aplica')),
  confidence TEXT CHECK (confidence IN ('Alta', 'Media', 'Baja')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  current_value REAL NOT NULL DEFAULT 0,
  included_in_balance INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  current_value REAL NOT NULL DEFAULT 0,
  included_in_balance INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debt_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL REFERENCES debts(id),
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
