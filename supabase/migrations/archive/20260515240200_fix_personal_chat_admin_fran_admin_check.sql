-- Prevent admins from inserting chat messages that appear to come from employees.
-- The previous WITH CHECK only verified is_app_admin(), which allowed admins to
-- set fran_admin = false and impersonate employee messages.
DROP POLICY IF EXISTS personal_chat_admin_all ON public.personal_chat;
CREATE POLICY personal_chat_admin_all ON public.personal_chat
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin() AND fran_admin = true);
