-- ============================================================
-- open-crm-client: customer portal authentication registry
--
-- Adds:
--   * `kund_users` linking auth.users <-> kunder (N:M, a single
--     auth user may hold accounts at multiple kunder).
--   * `is_kund_user_for(kund_id)` helper used inside policies.
--   * `current_user_kund_ids()` helper returning all kund_ids
--     that the calling auth user has access to.
--
-- Mirrors the `app_admins` / `is_app_admin()` pattern introduced
-- by 20260428120000 for open-crm-remote, but scoped per-kund
-- instead of global admin.
--
-- Untouched:
--   * The Electron desktop app uses service_role and bypasses RLS.
--   * Existing admin policies (`*_admin_all`) remain in place.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kund_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kund_id       uuid NOT NULL REFERENCES public.kunder(id) ON DELETE CASCADE,
  email         text,
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  skapad_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, kund_id)
);

CREATE INDEX IF NOT EXISTS idx_kund_users_auth ON public.kund_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_kund_users_kund ON public.kund_users(kund_id);

ALTER TABLE public.kund_users ENABLE ROW LEVEL SECURITY;

-- An authenticated user can read its own membership rows (used by
-- the client portal to discover which kunder it has access to).
DROP POLICY IF EXISTS kund_users_select_self ON public.kund_users;
CREATE POLICY kund_users_select_self ON public.kund_users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Admin app can read/write the whole table.
DROP POLICY IF EXISTS kund_users_admin_all ON public.kund_users;
CREATE POLICY kund_users_admin_all ON public.kund_users
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE OR REPLACE FUNCTION public.is_kund_user_for(check_kund_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.kund_users
     WHERE auth_user_id = auth.uid()
       AND kund_id = check_kund_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_kund_user_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_kund_user_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_kund_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kund_id
    FROM public.kund_users
   WHERE auth_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_kund_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_kund_ids() TO authenticated;

-- ============================================================
-- Post-deploy step (manual, NOT executed by this migration):
-- The customer is provisioned automatically by the IPC handler
-- queueKundUserAuthEmail() once the customer signs a forslag.
-- For pre-existing customers, the Electron CRM exposes a
-- "Skicka klientportal-inbjudan" button on the Kund detail.
-- ============================================================
