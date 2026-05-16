ALTER TABLE public.epost_mallar
  ADD COLUMN IF NOT EXISTS questions_json jsonb DEFAULT NULL;
