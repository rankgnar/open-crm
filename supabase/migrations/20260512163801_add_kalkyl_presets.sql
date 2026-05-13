ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS kalkyl_ventanatyper jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kalkyl_taktyper     jsonb DEFAULT '[]'::jsonb;
