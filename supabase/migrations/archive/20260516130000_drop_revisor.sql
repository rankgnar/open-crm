-- Remove all revisor calendar events before dropping the column
DELETE FROM kalender_events WHERE sync_revisor = true;
ALTER TABLE kalender_events DROP COLUMN IF EXISTS sync_revisor;

-- Drop revisor tables
DROP TABLE IF EXISTS revisor_deadlines;
DROP TABLE IF EXISTS revisor_anteckningar;
DROP TABLE IF EXISTS revisor_dokument;

-- Drop storage policies
DROP POLICY IF EXISTS "revisor_dokument_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "revisor_dokument_insert_admin" ON storage.objects;

-- Storage bucket must be deleted via the Storage API, not direct DML
