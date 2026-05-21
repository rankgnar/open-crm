-- Branding pack: app icon master + auto-generated favicon set.
-- Public bucket so the URLs work as-is in <link rel="icon">, manifest.json,
-- and og:image references from any of the apps (remote, app, future web).

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS branding_select ON storage.objects;
CREATE POLICY branding_select ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'branding');

-- INSERT/UPDATE/DELETE go through the service_role from the Electron main
-- process, which bypasses RLS by design. No public write policies needed.

ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS branding_ikon_master_url        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_favicon_16_url         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_favicon_32_url         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_apple_touch_icon_url   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_android_192_url        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_android_512_url        TEXT NOT NULL DEFAULT '';
