-- Track the URL of the signed PDF stored in the signed-docs bucket.

ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;
