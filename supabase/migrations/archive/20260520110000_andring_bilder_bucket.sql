INSERT INTO storage.buckets (id, name, public)
VALUES ('andring-bilder', 'andring-bilder', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS andring_bilder_select ON storage.objects;
CREATE POLICY andring_bilder_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'andring-bilder');

DROP POLICY IF EXISTS andring_bilder_insert ON storage.objects;
CREATE POLICY andring_bilder_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'andring-bilder'
    AND EXISTS (
      SELECT 1 FROM signatur_lankar sl
      WHERE sl.token = (storage.foldername(name))[1]
        AND sl.revoked_at IS NULL
        AND sl.gar_ut_at >= now()
    )
  );
