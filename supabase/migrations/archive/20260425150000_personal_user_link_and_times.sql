-- Link personal record to Supabase Auth user
ALTER TABLE personal
  ADD COLUMN supabase_user_id UUID UNIQUE;

CREATE INDEX ON personal (supabase_user_id);

-- Store check-in / check-out times on tidrapport
ALTER TABLE personal_tidrapport
  ADD COLUMN incheckning TIME,
  ADD COLUMN utcheckning TIME;

-- Employee ↔ Project assignment
CREATE TABLE projekt_personal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id  UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  skapad_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (projekt_id, personal_id)
);

CREATE INDEX ON projekt_personal (personal_id);
CREATE INDEX ON projekt_personal (projekt_id);
