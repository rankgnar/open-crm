-- Per-document visibility flag for the customer portal.
-- Documents default to hidden so admin must explicitly opt-in
-- to share. The client RLS policy is rewritten to require both
-- the kund-scope check and the synlig_for_kund flag.

ALTER TABLE public.projekt_dokument
  ADD COLUMN IF NOT EXISTS synlig_for_kund boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS projekt_dokument_client_select ON public.projekt_dokument;
CREATE POLICY projekt_dokument_client_select ON public.projekt_dokument
  FOR SELECT
  TO authenticated
  USING (
    synlig_for_kund = true
    AND projekt_id IN (
      SELECT id FROM public.projekt
       WHERE kund_id IN (SELECT public.current_user_kund_ids())
    )
  );
