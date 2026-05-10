-- The previous storage policies for signed-docs referenced signatur_lankar
-- directly, but that table has RLS without policies for anon → the EXISTS()
-- subquery always returned false from the customer-facing app, blocking all
-- uploads silently. Wrap the check in a SECURITY DEFINER function that
-- bypasses RLS for the targeted lookup.

CREATE OR REPLACE FUNCTION signatur_lank_uploadable(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM signatur_lankar
    WHERE token = p_token
      AND revoked_at IS NULL
      AND gar_ut_at >= now()
  );
$$;

REVOKE ALL ON FUNCTION signatur_lank_uploadable(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION signatur_lank_uploadable(TEXT) TO anon, authenticated;

-- Replace the storage policies to use the helper.
DROP POLICY IF EXISTS signed_docs_insert ON storage.objects;
CREATE POLICY signed_docs_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'signed-docs'
    AND signatur_lank_uploadable((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS signed_docs_update ON storage.objects;
CREATE POLICY signed_docs_update ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (
    bucket_id = 'signed-docs'
    AND signatur_lank_uploadable((storage.foldername(name))[1])
  );

-- SELECT is already public via signed_docs_select — no change needed.
