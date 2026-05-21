-- Adds a category to projekt_dokument so we can split the right-panel
-- between "Dokument" (general project files) and "Betalningsplan"
-- (invoices / orders / ÄTA). Existing rows default to 'dokument'.

ALTER TABLE public.projekt_dokument
  ADD COLUMN IF NOT EXISTS kategori text NOT NULL DEFAULT 'dokument';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projekt_dokument_kategori_check'
  ) THEN
    ALTER TABLE public.projekt_dokument
      ADD CONSTRAINT projekt_dokument_kategori_check
      CHECK (kategori IN ('dokument','faktura','order','ata'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projekt_dokument_projekt_kategori_idx
  ON public.projekt_dokument (projekt_id, kategori);
