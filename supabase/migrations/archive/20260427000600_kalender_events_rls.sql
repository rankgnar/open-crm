-- Allow assigned employees to create kalender events for their projects
-- (used by the personal app to log material requests as pending tasks).
-- SELECT/UPDATE/DELETE remain admin-only (service_role bypasses).

ALTER TABLE kalender_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY kalender_events_insert_assigned ON kalender_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    projekt_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE p.supabase_user_id = auth.uid()
        AND pp.projekt_id = kalender_events.projekt_id
        AND lower(p.status) <> 'inaktiv'
    )
  );
