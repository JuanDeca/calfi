ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT '🏷️';

UPDATE categories SET icon = CASE name
  WHEN 'Auto' THEN '🚗'
  WHEN 'Cigarrillos' THEN '🚬'
  WHEN 'Comida' THEN '🍔'
  WHEN 'Cuidado personal' THEN '💇'
  WHEN 'Educación' THEN '📚'
  WHEN 'Farmacia' THEN '💊'
  WHEN 'Ferretería' THEN '🔧'
  WHEN 'Fútbol' THEN '⚽'
  WHEN 'Gym' THEN '🏋️'
  WHEN 'Impuestos' THEN '🧾'
  WHEN 'Mejoras' THEN '🛠️'
  WHEN 'Movimiento entre cuentas/reservas' THEN '🔄'
  WHEN 'Otros' THEN '📦'
  WHEN 'Regalos' THEN '🎁'
  WHEN 'Ropa' THEN '👕'
  WHEN 'Salidas' THEN '🍻'
  WHEN 'Salud' THEN '🩺'
  WHEN 'Servicios' THEN '💡'
  WHEN 'Supermercado' THEN '🛒'
  WHEN 'Transferencias' THEN '💸'
  WHEN 'Transporte' THEN '🚌'
  WHEN 'Vacaciones' THEN '✈️'
  WHEN 'Ingresos' THEN '💰'
  WHEN 'Reintegros' THEN '↩️'
  ELSE icon
END;
