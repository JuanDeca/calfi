CREATE TABLE IF NOT EXISTS salary_allocation_buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  percentage REAL,
  active_months TEXT,
  pocket_keywords TEXT,
  destination_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salary_allocation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gross_amount REAL NOT NULL,
  breakdown_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO salary_allocation_buckets (key, label, percentage, active_months, pocket_keywords, destination_note, sort_order) VALUES
  ('inversion', 'Inversión a largo plazo', 10, NULL, '["Largo plazo","Largo plazo 10 PC mensual"]', 'Transferir a tu broker: alias tu.alias.broker · CBU 0000000000000000000000 · Tu Broker S.A. · CUIT 00-00000000-0. Repartir 25% FCI bajo riesgo / 17% VEA / 25% EEM / 33% SPY (se reajusta 1 vez al año).', 1),
  ('mejoras', 'Mejoras', 5, NULL, '["Mejoras","Gastos mejoras"]', NULL, 2),
  ('colchon_usd', 'Colchón USD', 5, NULL, '["Colchón transitorio"]', 'A fin de mes: comprar dólares y sumarlos al activo "Banco (USD)" en Patrimonio.', 3),
  ('deudas', 'Deudas (multas, impuesto inmobiliario, patente)', 5, NULL, '["Deudas","Deudas transitorio"]', NULL, 4),
  ('asado', 'Asado', 5, '12,1,2,3,4', '["Asado"]', 'Solo diciembre a abril.', 5),
  ('seguro_celular', 'Seguro, celular y tarjetas', NULL, NULL, '["Seguro y celular"]', 'Recordatorio: separar antes de gastar el resto del mes — incluye tarjetas de crédito.', 6);
