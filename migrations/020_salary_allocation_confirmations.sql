-- La plata parada en una reserva de MP genera su propio rendimiento, que no
-- aparece en ninguna transacción visible para Calfi (ni "Dinero
-- reservado/retirado", ni "Rendimientos" del saldo general) — por eso el saldo
-- calculado por patrón siempre queda corto respecto al real, más cuanto más
-- tiempo pase sin actividad. Cada confirmación guarda el saldo real que Juan
-- vio en la app de MP + la tasa diaria implícita desde la referencia anterior,
-- para poder proyectar una estimación hacia adelante hasta la próxima
-- confirmación (recordada cada ~90 días).
CREATE TABLE IF NOT EXISTS salary_allocation_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket_key TEXT NOT NULL,
  confirmed_balance REAL NOT NULL,
  daily_rate REAL NOT NULL,
  confirmed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
