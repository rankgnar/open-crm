ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS paminnelse_historik JSONB NOT NULL DEFAULT '[]'::jsonb;
