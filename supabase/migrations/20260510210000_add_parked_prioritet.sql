ALTER TABLE projekt DROP CONSTRAINT IF EXISTS projekt_prioritet_check;
ALTER TABLE projekt
  ADD CONSTRAINT projekt_prioritet_check
  CHECK (prioritet IN ('high', 'normal', 'low', 'parked'));
ALTER TABLE projekt ALTER COLUMN prioritet SET DEFAULT 'parked';
