-- Add direct employee assignment to calendar events
ALTER TABLE kalender_events ADD COLUMN personal_id uuid REFERENCES personal(id) ON DELETE SET NULL;
CREATE INDEX kalender_events_personal_idx ON kalender_events(personal_id);

-- RLS: employee can SELECT events assigned directly to them
CREATE POLICY kalender_events_personal_select ON kalender_events
  FOR SELECT TO authenticated
  USING (
    personal_id IS NOT NULL
    AND personal_id = (
      SELECT id FROM personal WHERE supabase_user_id = auth.uid() LIMIT 1
    )
  );

-- RLS: employee can SELECT events on their assigned projects
CREATE POLICY kalender_events_project_select ON kalender_events
  FOR SELECT TO authenticated
  USING (
    projekt_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM projekt_personal pp
      JOIN personal p ON p.id = pp.personal_id
      WHERE pp.projekt_id = kalender_events.projekt_id
        AND p.supabase_user_id = auth.uid()
        AND p.status <> 'inaktiv'
    )
  );
