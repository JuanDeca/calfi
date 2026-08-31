ALTER TABLE salary_allocation_buckets ADD COLUMN sub_allocations TEXT;

UPDATE salary_allocation_buckets
SET sub_allocations = '[{"label":"FCI bajo riesgo","percentage":25},{"label":"VEA","percentage":17},{"label":"EEM","percentage":25},{"label":"SPY","percentage":33}]',
    destination_note = 'Transferir a tu broker: alias tu.alias.broker · CBU 0000000000000000000000 · Tu Broker S.A. · CUIT 00-00000000-0. Las proporciones se reajustan una vez al año.'
WHERE key = 'inversion';
