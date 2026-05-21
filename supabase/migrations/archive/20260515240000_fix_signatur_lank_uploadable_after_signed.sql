-- Prevent uploading a new signed PDF after the document has already been signed.
-- Previously the policy only checked revoked_at and gar_ut_at, allowing a signer
-- to overwrite evidence after signing was complete.
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
      AND signerad_at IS NULL
      AND gar_ut_at >= now()
  );
$$;

REVOKE ALL ON FUNCTION signatur_lank_uploadable(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION signatur_lank_uploadable(TEXT) TO anon, authenticated;
