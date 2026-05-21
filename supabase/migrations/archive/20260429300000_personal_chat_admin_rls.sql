-- Admin (authenticated, app_admins) access to personal_chat for the
-- open-crm-remote PWA. The Electron desktop uses service_role and
-- bypasses RLS, so it is unaffected.

-- ============================================================
-- personal_chat: admin can read/write any thread.
-- ============================================================
DROP POLICY IF EXISTS personal_chat_admin_all ON public.personal_chat;
CREATE POLICY personal_chat_admin_all ON public.personal_chat
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- ============================================================
-- personal: admin can read all rows and update
-- admin_last_read_chat_at. The existing personal_select_own
-- policy for employees is left untouched.
-- ============================================================
DROP POLICY IF EXISTS personal_admin_all ON public.personal;
CREATE POLICY personal_admin_all ON public.personal
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
