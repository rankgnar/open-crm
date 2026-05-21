-- Storage bucket for the signed PDF copies that the customer-facing app
-- generates and uploads after signing. Public read so the link in the
-- confirmation email works without auth. INSERT scoped to valid tokens.

INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-docs', 'signed-docs', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read.
DROP POLICY IF EXISTS signed_docs_select ON storage.objects;
CREATE POLICY signed_docs_select ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'signed-docs');

-- Anon can INSERT to signed-docs/<token>/* iff a non-revoked, non-expired
-- signatur_lankar row exists with that token (regardless of signed state,
-- so the upload can race the signing call).
DROP POLICY IF EXISTS signed_docs_insert ON storage.objects;
CREATE POLICY signed_docs_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'signed-docs'
    AND EXISTS (
      SELECT 1 FROM signatur_lankar sl
      WHERE sl.token = (storage.foldername(name))[1]
        AND sl.revoked_at IS NULL
        AND sl.gar_ut_at >= now()
    )
  );

-- Allow same-token UPDATE so client can upsert (retry path)
DROP POLICY IF EXISTS signed_docs_update ON storage.objects;
CREATE POLICY signed_docs_update ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (
    bucket_id = 'signed-docs'
    AND EXISTS (
      SELECT 1 FROM signatur_lankar sl
      WHERE sl.token = (storage.foldername(name))[1]
        AND sl.revoked_at IS NULL
        AND sl.gar_ut_at >= now()
    )
  );
