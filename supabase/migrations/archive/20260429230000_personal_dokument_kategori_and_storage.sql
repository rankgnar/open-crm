-- Utöka personal_dokument med kategori-fält så att admin kan ladda
-- upp både lönespecar och övriga dokument till samma tabell + bucket.
-- Empleado-PWAn läser via authenticated; admin (Electron) använder
-- service_role och kringgår RLS.

ALTER TABLE personal_dokument
  ADD COLUMN IF NOT EXISTS kategori TEXT NOT NULL DEFAULT 'dokument'
    CHECK (kategori IN ('lonespec', 'dokument'));

CREATE INDEX IF NOT EXISTS idx_personal_dokument_personal_kategori
  ON personal_dokument (personal_id, kategori, skapad_at DESC);

-- Empleado läser sina egna dokument via anon key + RLS.
DROP POLICY IF EXISTS dokument_select_own ON personal_dokument;
CREATE POLICY dokument_select_own ON personal_dokument
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: enbart service_role (admin via Electron).

-- ============================================================
-- Storage bucket: personal-dokument (privat)
-- Path-konvention: <personal_id>/<kategori>/<uuid>.<ext>
-- Första foldername-segmentet = personal_id används av RLS.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('personal-dokument', 'personal-dokument', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "personal_dokument_select_own" ON storage.objects;
CREATE POLICY "personal_dokument_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'personal-dokument'
    AND EXISTS (
      SELECT 1 FROM personal p
      WHERE p.supabase_user_id = auth.uid()
        AND p.id::text = (storage.foldername(name))[1]
    )
  );

-- INSERT/DELETE i bucket sker via service_role (admin Electron).
