ALTER TABLE categorization_rules
  ADD COLUMN impacts_analysis TEXT CHECK (impacts_analysis IN ('Sí', 'No', 'Pendiente'));
