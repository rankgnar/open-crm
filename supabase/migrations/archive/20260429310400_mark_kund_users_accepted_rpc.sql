-- ============================================================
-- Allow a kund_user to flag its own membership as accepted on first
-- successful login of the klientportal. The kund_users RLS only
-- exposes SELECT to the user — UPDATE is denied — so we route the
-- update through a SECURITY DEFINER RPC bound to auth.uid().
--
-- Idempotent: only sets accepted_at when it's NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_my_kund_users_accepted()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.kund_users
     SET accepted_at = now()
   WHERE auth_user_id = auth.uid()
     AND accepted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.mark_my_kund_users_accepted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_my_kund_users_accepted() TO authenticated;
