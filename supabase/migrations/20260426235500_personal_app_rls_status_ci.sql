-- Make personal app RLS case-insensitive about status, since the CRM uses both
-- capitalized catalog names ('Aktiv', 'Provanställd', 'Sjukskriven', 'Inaktiv')
-- and lowercase from the CSV importer ('aktiv', 'inaktiv').
-- New rule: only 'Inaktiv' (case-insensitive) blocks app access.

CREATE OR REPLACE FUNCTION link_personal_to_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email     text;
  active_count   int;
  matched_row    personal%ROWTYPE;
BEGIN
  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT count(*) INTO active_count
  FROM personal
  WHERE supabase_user_id IS NULL
    AND lower(status) <> 'inaktiv'
    AND lower(email) = user_email;

  IF active_count > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous');
  END IF;

  IF active_count = 0 THEN
    IF EXISTS (
      SELECT 1 FROM personal
      WHERE lower(email) = user_email
        AND lower(status) = 'inaktiv'
    ) THEN
      RETURN jsonb_build_object('status', 'inactive');
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  UPDATE personal
  SET supabase_user_id = auth.uid()
  WHERE supabase_user_id IS NULL
    AND lower(status) <> 'inaktiv'
    AND lower(email) = user_email
  RETURNING * INTO matched_row;

  IF matched_row.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', 'linked', 'record', to_jsonb(matched_row));
END;
$$;

DROP POLICY IF EXISTS tidrapport_insert_own ON personal_tidrapport;
CREATE POLICY tidrapport_insert_own ON personal_tidrapport
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
        AND lower(p.status) <> 'inaktiv'
    )
  );

DROP POLICY IF EXISTS ledighet_insert_own ON personal_ledighet;
CREATE POLICY ledighet_insert_own ON personal_ledighet
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
        AND lower(p.status) <> 'inaktiv'
    )
  );

-- Cleanup: unlink the wrong record that got auto-linked by the previous (buggy) code path.
-- The user will be re-linked to the correct active record on next login.
UPDATE personal
SET supabase_user_id = NULL
WHERE id = '4669c237-d1ba-4492-ab36-259284711439'
  AND lower(status) = 'inaktiv';
