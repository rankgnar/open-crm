-- Allow customer-portal users (kund_users) to fetch signed URLs for
-- documents flagged synlig_for_kund=true on projekt they belong to.
--
-- Background: 20260427000000_projekt_dokument_rls replaced the open-everything
-- storage policy with a personal-assignment-scoped one. That left the
-- customer portal unable to call createSignedUrl(s) — Storage RLS rejects
-- with 400 even though the metadata-table policy
-- (projekt_dokument_client_select) lets the customer SEE the row.
--
-- Path convention: `<projekt_id>/<timestamp>_<filename>` (see
-- src/main/ipc/projekt.ts handler `db:projekt-dokument:upload`), so we
-- can match storage.objects.name against projekt_dokument.storage_path.
--
-- We mirror the metadata policy: visibility requires synlig_for_kund=true
-- AND the projekt's kund_id must be in current_user_kund_ids().

DROP POLICY IF EXISTS "projekt_dokument_select_kund" ON storage.objects;

CREATE POLICY "projekt_dokument_select_kund" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projekt-dokument'
    AND EXISTS (
      SELECT 1
        FROM public.projekt_dokument pd
        JOIN public.projekt p ON p.id = pd.projekt_id
       WHERE pd.storage_path = storage.objects.name
         AND pd.synlig_for_kund = true
         AND p.kund_id IN (SELECT public.current_user_kund_ids())
    )
  );
