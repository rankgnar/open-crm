ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS avslut_feedback_aktiv boolean NOT NULL DEFAULT false;
