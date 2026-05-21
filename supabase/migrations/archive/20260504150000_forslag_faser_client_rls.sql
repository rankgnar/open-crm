-- ============================================================
-- forslag_faser: customer-portal SELECT policy
--
-- Mirrors the join used by forslag_client_select
-- (20260429310100_kund_users_rls_policies.sql:39-49):
-- a kund user can read fas rows of any forslag whose status is
-- not 'utkast' AND whose projekt belongs to a kund the user is
-- linked to via kund_users.
--
-- The portal renders a Tidplan tab built from these phases.
-- subfaser and arbetskostnad stay private to the CRM.
-- ============================================================

DROP POLICY IF EXISTS forslag_faser_client_select ON public.forslag_faser;
CREATE POLICY forslag_faser_client_select ON public.forslag_faser
  FOR SELECT
  TO authenticated
  USING (
    forslag_id IN (
      SELECT id FROM public.forslag
       WHERE status <> 'utkast'
         AND projekt_id IN (
           SELECT id FROM public.projekt
            WHERE kund_id IN (SELECT public.current_user_kund_ids())
         )
    )
  );
