ALTER TABLE categories ADD COLUMN linked_asset_id INTEGER REFERENCES assets(id);
