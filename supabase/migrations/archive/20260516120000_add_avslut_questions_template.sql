ALTER TABLE public.app_installningar
  ADD COLUMN IF NOT EXISTS avslut_questions_template jsonb DEFAULT NULL;
