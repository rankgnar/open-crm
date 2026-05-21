-- Remove unique constraint so each workflow run creates a new entry.
-- data:context always reads the latest entry (ORDER BY skapad_at DESC).

ALTER TABLE projekt_context
  DROP CONSTRAINT IF EXISTS projekt_context_projekt_id_nyckel_key;
