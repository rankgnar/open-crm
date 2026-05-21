-- Free-text note where the admin can store login credentials
-- (klientportal password, etc.) for personal testing purposes only.
-- Not exposed to the customer. service_role bypasses RLS as usual.

ALTER TABLE public.kunder
  ADD COLUMN IF NOT EXISTS login_anteckning text;
