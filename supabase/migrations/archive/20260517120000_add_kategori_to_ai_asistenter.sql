ALTER TABLE ai_asistenter
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Allmänt';
