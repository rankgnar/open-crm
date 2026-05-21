CREATE TABLE fakturaplan_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id        uuid NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  forslag_id        uuid NOT NULL REFERENCES forslag(id) ON DELETE CASCADE,
  forslag_nummer    text NOT NULL,
  forslag_titel     text NOT NULL,
  total_arbete      numeric NOT NULL DEFAULT 0,
  total_material    numeric NOT NULL DEFAULT 0,
  total_ue          numeric NOT NULL DEFAULT 0,
  total_netto       numeric NOT NULL DEFAULT 0,
  rot_eligible      numeric NOT NULL DEFAULT 0,
  rot_avdrag        numeric NOT NULL DEFAULT 0,
  moms_totalt       numeric NOT NULL DEFAULT 0,
  att_betala_totalt numeric NOT NULL DEFAULT 0,
  etapper           jsonb NOT NULL DEFAULT '[]',
  skapad_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fakturaplan_snapshots_forslag_id_key ON fakturaplan_snapshots(forslag_id);
