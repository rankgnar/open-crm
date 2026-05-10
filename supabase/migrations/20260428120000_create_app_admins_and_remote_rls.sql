-- ============================================================
-- open-crm-remote: admin authentication + global RLS access
--
-- Adds:
--   * `app_admins` registry of admin users (auth.uid() ↔ admin)
--   * `is_app_admin()` helper used inside policies
--   * Admin-all policies on the tables consumed by the mobile
--     admin app: kunder, projekt, forslag*, ata*, plus admin
--     overrides on tables that already have employee-scoped RLS
--     (projekt_anteckningar, projekt_dokument, kalender_events).
--   * Storage admin SELECT policy on `projekt-dokument` bucket.
--
-- Untouched:
--   * The Electron desktop app uses service_role → bypasses RLS.
--   * The employee app (`open-crm-app`) keeps its existing
--     supabase_user_id-scoped policies; we only add policies.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  skapad_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- An authenticated user can read its own admin row (used by the
-- mobile app to verify membership). No insert/update/delete from
-- clients — only service_role manages this table.
DROP POLICY IF EXISTS app_admins_select_self ON public.app_admins;
CREATE POLICY app_admins_select_self ON public.app_admins
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ============================================================
-- Tables with no prior RLS: enable + add admin-all policy.
-- ============================================================

ALTER TABLE public.kunder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kunder_admin_all ON public.kunder;
CREATE POLICY kunder_admin_all ON public.kunder
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.projekt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projekt_admin_all ON public.projekt;
CREATE POLICY projekt_admin_all ON public.projekt
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_admin_all ON public.forslag;
CREATE POLICY forslag_admin_all ON public.forslag
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag_faser ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_faser_admin_all ON public.forslag_faser;
CREATE POLICY forslag_faser_admin_all ON public.forslag_faser
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag_subfaser ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_subfaser_admin_all ON public.forslag_subfaser;
CREATE POLICY forslag_subfaser_admin_all ON public.forslag_subfaser
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag_arbetskostnad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_arbetskostnad_admin_all ON public.forslag_arbetskostnad;
CREATE POLICY forslag_arbetskostnad_admin_all ON public.forslag_arbetskostnad
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag_materialkostnad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_materialkostnad_admin_all ON public.forslag_materialkostnad;
CREATE POLICY forslag_materialkostnad_admin_all ON public.forslag_materialkostnad
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.forslag_underentreprenorer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forslag_underentreprenorer_admin_all ON public.forslag_underentreprenorer;
CREATE POLICY forslag_underentreprenorer_admin_all ON public.forslag_underentreprenorer
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.ata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ata_admin_all ON public.ata;
CREATE POLICY ata_admin_all ON public.ata
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.ata_rader ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ata_rader_admin_all ON public.ata_rader;
CREATE POLICY ata_rader_admin_all ON public.ata_rader
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- ============================================================
-- Tables with prior employee RLS: add admin-all policy alongside.
-- The existing employee policies remain unchanged.
-- ============================================================

DROP POLICY IF EXISTS projekt_anteckningar_admin_all ON public.projekt_anteckningar;
CREATE POLICY projekt_anteckningar_admin_all ON public.projekt_anteckningar
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS projekt_dokument_admin_all ON public.projekt_dokument;
CREATE POLICY projekt_dokument_admin_all ON public.projekt_dokument
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS kalender_events_admin_all ON public.kalender_events;
CREATE POLICY kalender_events_admin_all ON public.kalender_events
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- ============================================================
-- Numbering: allow authenticated callers (admin app) to draw the
-- next ATA number. The Electron desktop talks via service_role
-- so it doesn't need this; this is purely for the mobile app
-- when it creates an ÄTA from the field.
-- ============================================================

GRANT USAGE ON SEQUENCE public.ata_nummer_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.nextval_ata_nummer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_ata_nummer()    TO authenticated;

-- ============================================================
-- Storage: admin can read files in `projekt-dokument` bucket.
-- (Upload/delete from mobile is out of MVP scope.)
-- ============================================================

DROP POLICY IF EXISTS "projekt_dokument_select_admin" ON storage.objects;
CREATE POLICY "projekt_dokument_select_admin" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projekt-dokument'
    AND public.is_app_admin()
  );

-- ============================================================
-- Post-deploy step (manual, NOT executed by this migration):
-- After signing up the admin via Supabase Auth, register the user:
--
--   INSERT INTO public.app_admins (auth_user_id, email)
--   SELECT id, email FROM auth.users WHERE email = '<your-admin-email>';
-- ============================================================
