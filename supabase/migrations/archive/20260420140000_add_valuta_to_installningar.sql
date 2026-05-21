ALTER TABLE app_installningar ADD COLUMN IF NOT EXISTS valuta VARCHAR(10) DEFAULT 'kr';
UPDATE app_installningar SET valuta = 'kr' WHERE valuta IS NULL;
