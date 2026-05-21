-- Lock down app_installningar from anon/authenticated.
-- Without this, any holder of the anon key (i.e. every web SPA bundle) can
-- read fortnox/zoho/google secrets, refresh tokens, and ai_api_key.
--
-- Defense in depth:
--   1. REVOKE broad privileges from anon/authenticated.
--   2. GRANT column-level SELECT only on public-safe columns.
--   3. ENABLE RLS with a single permissive SELECT policy (so the row is
--      reachable through PostgREST under the column grants above).
--
-- Electron main uses service_role and bypasses both grants and RLS.
-- Public signing RPCs (get_signing_doc, submit_signature, …) are
-- SECURITY DEFINER and execute as the function owner, so they keep
-- working unchanged.
--
-- New columns added later are NOT readable from anon by default — extend
-- the GRANT below explicitly when adding more public-safe columns.

REVOKE SELECT, INSERT, UPDATE, DELETE ON app_installningar FROM anon, authenticated;

GRANT SELECT (
  foretag_namn,
  foretag_logo_url,
  branding_ikon_master_url,
  branding_favicon_16_url,
  branding_favicon_32_url,
  branding_apple_touch_icon_url,
  branding_android_192_url,
  branding_android_512_url
) ON app_installningar TO anon, authenticated;

ALTER TABLE app_installningar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_installningar_public_select ON app_installningar;
CREATE POLICY app_installningar_public_select ON app_installningar
  FOR SELECT TO anon, authenticated
  USING (true);
