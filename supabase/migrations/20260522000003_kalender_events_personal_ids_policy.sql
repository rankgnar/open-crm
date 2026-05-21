-- RLS: employee can SELECT events assigned to them via personal_ids array
CREATE POLICY kalender_events_personal_ids_select ON kalender_events
  FOR SELECT TO authenticated
  USING (
    personal_ids IS NOT NULL
    AND array_length(personal_ids, 1) > 0
    AND EXISTS (
      SELECT 1 FROM personal
      WHERE supabase_user_id = auth.uid()
        AND id::text = ANY(personal_ids)
      LIMIT 1
    )
  );
