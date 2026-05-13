ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS kalkyl_tak_avdrag  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kalkyl_golv_avdrag jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kalkyl_vagg_avdrag jsonb DEFAULT '[]'::jsonb;
