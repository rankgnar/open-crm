ALTER TABLE projekt
  ADD COLUMN IF NOT EXISTS prioritet text NOT NULL DEFAULT 'normal'
  CHECK (prioritet IN ('high', 'normal', 'low'));
