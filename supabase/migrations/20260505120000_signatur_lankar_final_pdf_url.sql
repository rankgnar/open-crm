-- Persist a second pre-rendered PDF for förslag signed with Titel 1 today
-- but expected to upgrade to Titel 2 (e.g. "Slutlig-Offert") once signed.
-- The customer portal stamps the signature on this URL when present.
-- NULL means no upgrade applies (titel2 missing or admin chose titel2 directly).
ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS final_document_pdf_url TEXT;
