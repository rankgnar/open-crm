-- RLS for the employee-facing web app (open-crm-app).
-- Service role (CRM admin) bypasses all policies automatically.

-- ============================================================
-- personal: own record only. Auto-link goes through an RPC.
-- ============================================================

ALTER TABLE personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY personal_select_own ON personal
  FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());

-- INSERT/UPDATE/DELETE: service_role only (no policies for authenticated).

-- Atomic auto-link: handles ambiguity, inactive matches, and races server-side.
CREATE OR REPLACE FUNCTION link_personal_to_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email   text;
  active_count int;
  matched_row  personal%ROWTYPE;
BEGIN
  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT count(*) INTO active_count
  FROM personal
  WHERE supabase_user_id IS NULL
    AND status = 'aktiv'
    AND lower(email) = user_email;

  IF active_count > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous');
  END IF;

  IF active_count = 0 THEN
    IF EXISTS (
      SELECT 1 FROM personal
      WHERE lower(email) = user_email
        AND status <> 'aktiv'
    ) THEN
      RETURN jsonb_build_object('status', 'inactive');
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  UPDATE personal
  SET supabase_user_id = auth.uid()
  WHERE supabase_user_id IS NULL
    AND status = 'aktiv'
    AND lower(email) = user_email
  RETURNING * INTO matched_row;

  IF matched_row.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', 'linked', 'record', to_jsonb(matched_row));
END;
$$;

REVOKE ALL ON FUNCTION link_personal_to_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_personal_to_auth() TO authenticated;

-- ============================================================
-- personal_tidrapport: own records, can submit + cancel pending
-- ============================================================

ALTER TABLE personal_tidrapport ENABLE ROW LEVEL SECURITY;

CREATE POLICY tidrapport_select_own ON personal_tidrapport
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY tidrapport_insert_own ON personal_tidrapport
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
        AND p.status = 'aktiv'
    )
  );

CREATE POLICY tidrapport_delete_own_pending ON personal_tidrapport
  FOR DELETE
  TO authenticated
  USING (
    status = 'inskickad'
    AND EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

-- ============================================================
-- personal_ledighet: same shape as tidrapport
-- ============================================================

ALTER TABLE personal_ledighet ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledighet_select_own ON personal_ledighet
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY ledighet_insert_own ON personal_ledighet
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
        AND p.status = 'aktiv'
    )
  );

CREATE POLICY ledighet_delete_own_pending ON personal_ledighet
  FOR DELETE
  TO authenticated
  USING (
    status = 'inskickad'
    AND EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

-- ============================================================
-- projekt_personal: read-only, own assignments
-- ============================================================

ALTER TABLE projekt_personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_select_own ON projekt_personal
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

-- ============================================================
-- HR-only tables: service_role exclusive
-- ============================================================

ALTER TABLE personal_anteckningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_dokument     ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_loneposter   ENABLE ROW LEVEL SECURITY;
-- No policies = no access for authenticated/anon. Admin uses service_role.
