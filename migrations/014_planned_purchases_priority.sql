ALTER TABLE planned_purchases ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
UPDATE planned_purchases SET priority = id;
