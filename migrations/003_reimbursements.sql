ALTER TABLE categories ADD COLUMN excluded_from_analysis INTEGER NOT NULL DEFAULT 0;

ALTER TABLE transactions ADD COLUMN reimburses_transaction_id INTEGER REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN reimbursement_expected REAL;
