-- Los pockets de MP "Largo plazo" (Inversión) y "Colchón transitorio" quedaron
-- en desuso desde hace meses: Juan confirmó que ya no reserva/retira ahí, el
-- 10% de Inversión va directo a PPI (desde banco o MP) y el 5% de Colchón USD
-- se compra directo en dólares a fin de mes, sin pasar por un ciclo mensual de
-- reserva. Mostrar un "saldo en tránsito en MP" que no se mueve hace 5+ meses
-- no aporta nada — se saca el tracking de esos dos, queda solo la referencia a
-- los activos reales de Patrimonio (Inversiones (USD) y Banco (USD)).
UPDATE salary_allocation_buckets SET pocket_keywords = NULL WHERE key IN ('inversion', 'colchon_usd');

-- Deudas sí sigue con un ciclo real: transitorio en pesos (ya trackeado arriba)
-- que eventualmente se convierte a la reserva definitiva en dólares dentro de
-- MP — esa parte vive en el activo nuevo "Deudas (reserva USD en MP)" de
-- Patrimonio, que hay que actualizar a mano cuando se hace la conversión.
UPDATE salary_allocation_buckets
SET destination_note = 'Cuando conviertas el transitorio a dólares, actualizar el activo "Deudas (reserva USD en MP)" en Patrimonio.'
WHERE key = 'deudas';
