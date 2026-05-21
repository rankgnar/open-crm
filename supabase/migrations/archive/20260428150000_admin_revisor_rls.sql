-- Admin (open-crm-remote PWA) access to the Revisor module.
-- The 3 tables and the storage bucket were created without RLS
-- (desktop uses service_role); this migration enables RLS and
-- grants the admin user full access. Employee app doesn't touch
-- revisor today, so no employee-scoped policy is needed yet.

ALTER TABLE public.revisor_deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisor_deadlines_admin_all ON public.revisor_deadlines;
CREATE POLICY revisor_deadlines_admin_all ON public.revisor_deadlines
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.revisor_anteckningar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisor_anteckningar_admin_all ON public.revisor_anteckningar;
CREATE POLICY revisor_anteckningar_admin_all ON public.revisor_anteckningar
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

ALTER TABLE public.revisor_dokument ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisor_dokument_admin_all ON public.revisor_dokument;
CREATE POLICY revisor_dokument_admin_all ON public.revisor_dokument
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Storage: admin SELECT + INSERT on revisor-dokument bucket.
-- DELETE intentionally omitted; admin cleanup happens from desktop.

DROP POLICY IF EXISTS "revisor_dokument_select_admin" ON storage.objects;
CREATE POLICY "revisor_dokument_select_admin" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'revisor-dokument'
    AND public.is_app_admin()
  );

DROP POLICY IF EXISTS "revisor_dokument_insert_admin" ON storage.objects;
CREATE POLICY "revisor_dokument_insert_admin" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'revisor-dokument'
    AND public.is_app_admin()
  );
