-- Fix forslag_client_select and forslag_faser_client_select RLS policies.
-- Both used lowercase 'utkast' as the draft guard, but the canonical status
-- value (since 20260420220000_create_forslag_statusar) is 'Utkast' (capital).
-- With all forslag.status values now capitalized, the old guard
--   status <> 'utkast'
-- always evaluated to TRUE, meaning kund_users could see draft förslag.

DROP POLICY IF EXISTS forslag_client_select ON public.forslag;
CREATE POLICY forslag_client_select ON public.forslag
  FOR SELECT
  TO authenticated
  USING (
    status <> 'Utkast'
    AND projekt_id IN (
      SELECT id FROM public.projekt
       WHERE kund_id IN (SELECT public.current_user_kund_ids())
    )
  );

DROP POLICY IF EXISTS forslag_faser_client_select ON public.forslag_faser;
CREATE POLICY forslag_faser_client_select ON public.forslag_faser
  FOR SELECT
  TO authenticated
  USING (
    forslag_id IN (
      SELECT id FROM public.forslag
       WHERE status <> 'Utkast'
         AND projekt_id IN (
           SELECT id FROM public.projekt
            WHERE kund_id IN (SELECT public.current_user_kund_ids())
         )
    )
  );
