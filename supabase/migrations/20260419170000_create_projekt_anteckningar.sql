ALTER TABLE projekt DROP COLUMN IF EXISTS interna_anteckningar;

CREATE TABLE IF NOT EXISTS projekt_anteckningar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  innehall TEXT NOT NULL,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projekt_anteckningar_projekt_id ON projekt_anteckningar(projekt_id);
