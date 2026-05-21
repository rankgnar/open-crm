-- Chat anställd ↔ admin. En tråd per anställd, bara text.
-- Anställda skriver via anon key + RLS. Admin (Electron) använder
-- service_role och kringgår RLS automatiskt.

CREATE TABLE IF NOT EXISTS personal_chat (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  fran_admin  BOOLEAN NOT NULL,
  innehall    TEXT NOT NULL,
  skapad_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_chat_personal_id_skapad_at
  ON personal_chat (personal_id, skapad_at DESC);

-- Spara när admin senast läste tråden för att visa olästa-badge.
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS admin_last_read_chat_at TIMESTAMPTZ;

ALTER TABLE personal_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_select_own ON personal_chat;
CREATE POLICY chat_select_own ON personal_chat
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_insert_own ON personal_chat;
CREATE POLICY chat_insert_own ON personal_chat
  FOR INSERT
  TO authenticated
  WITH CHECK (
    fran_admin = false
    AND EXISTS (
      SELECT 1 FROM personal p
      WHERE p.id = personal_id
        AND p.supabase_user_id = auth.uid()
        AND lower(p.status) <> 'inaktiv'
    )
  );
