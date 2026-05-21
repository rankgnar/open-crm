-- Replace forslag_subkontraktorer (forslag-level) with underentreprenorer (subfas-level)
DROP TABLE IF EXISTS forslag_subkontraktorer;

CREATE TABLE forslag_underentreprenorer (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subfas_id     UUID NOT NULL REFERENCES forslag_subfaser(id) ON DELETE CASCADE,
  namn          TEXT NOT NULL DEFAULT '',
  beskrivning   TEXT DEFAULT '',
  inkl_material BOOLEAN DEFAULT false,
  kostnad       NUMERIC(12,2) DEFAULT 0,
  skapad_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_forslag_ue_subfas_id ON forslag_underentreprenorer(subfas_id);
