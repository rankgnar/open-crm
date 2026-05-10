-- Allow admin (open-crm-remote PWA) to upload files to the
-- `projekt-dokument` storage bucket. The migration that introduced
-- admin access (20260428120000) only granted SELECT on the bucket;
-- this completes the admin permissions so the mobile app can attach
-- photos and documents from the field.
--
-- DELETE intentionally not granted yet — admin handles cleanup from
-- desktop (service_role) until we add a delete UI in the PWA.

DROP POLICY IF EXISTS "projekt_dokument_insert_admin" ON storage.objects;
CREATE POLICY "projekt_dokument_insert_admin" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projekt-dokument'
    AND public.is_app_admin()
  );
