ALTER TABLE pdf_mallar
  ADD COLUMN IF NOT EXISTS visa_villkor boolean NOT NULL DEFAULT true;
