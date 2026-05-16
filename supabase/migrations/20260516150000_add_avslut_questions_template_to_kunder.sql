ALTER TABLE public.kunder
  ADD COLUMN IF NOT EXISTS avslut_questions_template jsonb DEFAULT NULL;
