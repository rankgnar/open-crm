-- Track which employee uploaded each project document.
-- Service role still bypasses RLS, so the CRM admin can keep this NULL when
-- uploading manually. Authenticated employees must set it to their own personal.id.

ALTER TABLE projekt_dokument
  ADD COLUMN uppladdad_av_personal_id UUID NULL REFERENCES personal(id) ON DELETE SET NULL;

CREATE INDEX ON projekt_dokument (uppladdad_av_personal_id);

-- Tighten INSERT policy: row must claim the current employee as uploader.
DROP POLICY IF EXISTS projekt_dokument_insert_assigned ON projekt_dokument;
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
        AND p.id = projekt_dokument.uppladdad_av_personal_id
    )
  );
