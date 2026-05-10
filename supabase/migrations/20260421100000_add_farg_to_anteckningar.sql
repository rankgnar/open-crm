ALTER TABLE projekt_anteckningar
  ADD COLUMN farg text NOT NULL DEFAULT 'muted'
  CHECK (farg IN ('emerald', 'amber', 'red', 'blue', 'muted'));
