-- El concepto de "confianza" venía de cuando la categorización histórica se
-- hacía asistida por IA. Calfi categoriza con reglas determinísticas por
-- contraparte, así que ese campo dejó de aportar información real.
ALTER TABLE transactions DROP COLUMN confidence;
ALTER TABLE categorization_rules DROP COLUMN confidence;
