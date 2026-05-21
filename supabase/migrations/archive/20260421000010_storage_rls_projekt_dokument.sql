-- Allow anon/authenticated to upload, read, and delete from projekt-dokument bucket
CREATE POLICY "allow all operations" ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'projekt-dokument')
  WITH CHECK (bucket_id = 'projekt-dokument');
