-- Mirror signature fields already on ordrar onto forslag, so the same RPC
-- flow can update both document types when the customer signs via public link.

ALTER TABLE forslag
  ADD COLUMN IF NOT EXISTS godkand_av TEXT,
  ADD COLUMN IF NOT EXISTS godkand_datum TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signatur_data TEXT;
