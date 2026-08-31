-- Transacciones importadas del Excel histórico con confidence='Media' de la vieja
-- categorización asistida por IA, pero ya confirmadas (impacts_analysis='Sí') dentro
-- de Calfi. No hay razón para seguir marcándolas como inciertas.
UPDATE transactions SET confidence = 'Alta' WHERE confidence = 'Media' AND impacts_analysis = 'Sí';
