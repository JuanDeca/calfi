ALTER TABLE transactions ADD COLUMN original_amount_usd REAL;
ALTER TABLE transactions ADD COLUMN usd_exchange_rate REAL;
ALTER TABLE recurring_movements ADD COLUMN default_amount_usd REAL;
