-- Allow assigned employees to insert anteckningar on their projects.
-- SELECT/UPDATE/DELETE remain admin-only (service_role bypass).

ALTER TABLE projekt_anteckningar ENABLE ROW LEVEL SECURITY;

CREATE POLICY projekt_anteckningar_insert_assigned ON projekt_anteckningar
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id = projekt_anteckningar.projekt_id
        AND lower(p.status) <> 'inaktiv'
    )
  );
