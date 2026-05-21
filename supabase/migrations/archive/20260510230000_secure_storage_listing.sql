-- Remove bucket-level listing from the 3 public storage buckets.
-- Direct file URLs continue to work — public buckets serve via CDN independently of this policy.
-- The only .list() call on these buckets is in src/main/ipc/signera.ts via service_role (unaffected).

-- branding
DROP POLICY IF EXISTS "branding_select" ON storage.objects;
CREATE POLICY "branding_select_direct_only" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding' AND name IS NOT NULL AND name <> '');

-- signed-docs
DROP POLICY IF EXISTS "signed_docs_select" ON storage.objects;
CREATE POLICY "signed_docs_select_direct_only" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'signed-docs' AND name IS NOT NULL AND name <> '');

-- signing-pdfs
DROP POLICY IF EXISTS "signing_pdfs_select" ON storage.objects;
CREATE POLICY "signing_pdfs_select_direct_only" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'signing-pdfs' AND name IS NOT NULL AND name <> '');
