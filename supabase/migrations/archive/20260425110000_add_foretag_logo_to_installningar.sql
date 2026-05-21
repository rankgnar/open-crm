ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS foretag_logo_url TEXT NOT NULL DEFAULT '';
