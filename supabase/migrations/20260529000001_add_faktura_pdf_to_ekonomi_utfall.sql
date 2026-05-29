ALTER TABLE ekonomi_utfall
  ADD COLUMN IF NOT EXISTS faktura_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS faktura_pdf_namn TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kostnader-fakturor', 'kostnader-fakturor', false)
ON CONFLICT (id) DO NOTHING;
