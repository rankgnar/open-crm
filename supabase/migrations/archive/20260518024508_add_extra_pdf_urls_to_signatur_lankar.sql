ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS specifikation_pdf_url text,
  ADD COLUMN IF NOT EXISTS tidplan_pdf_url text;
