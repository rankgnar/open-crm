-- Logon centraliseras i app_installningar.foretag_logo_url och används av alla PDF-mallar.
-- Per-mall-logo behövs inte längre.

ALTER TABLE pdf_mallar
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS visa_logo;
