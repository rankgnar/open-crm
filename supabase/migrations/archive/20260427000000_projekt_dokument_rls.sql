-- Tighten projekt-dokument access so employees can only upload/read documents
-- of projects they're assigned to via projekt_personal.
-- Service role (CRM admin) bypasses everything automatically.

-- ============================================================
-- Storage bucket: replace open-everything policy with assignment-scoped ones.
-- Path convention is `<projekt_id>/<timestamp>_<filename>`, so the first
-- folder segment is the projekt_id.
-- ============================================================

DROP POLICY IF EXISTS "allow all operations" ON storage.objects;

CREATE POLICY "projekt_dokument_select_assigned" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projekt-dokument'
    AND EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "projekt_dokument_insert_assigned" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projekt-dokument'
    AND EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id::text = (storage.foldername(name))[1]
        AND lower(p.status) <> 'inaktiv'
    )
  );

-- DELETE deliberately not granted to authenticated. Admin (service_role) handles cleanup.

-- ============================================================
-- Metadata table projekt_dokument: same scoping
-- ============================================================

ALTER TABLE projekt_dokument ENABLE ROW LEVEL SECURITY;

CREATE POLICY projekt_dokument_select_assigned ON projekt_dokument
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id = projekt_dokument.projekt_id
    )
  );

CREATE POLICY projekt_dokument_insert_assigned ON projekt_dokument
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id = projekt_dokument.projekt_id
        AND lower(p.status) <> 'inaktiv'
    )
  );

-- DELETE/UPDATE: service_role only.
