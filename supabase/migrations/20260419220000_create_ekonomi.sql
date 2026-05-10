CREATE TABLE ekonomi_utfall (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id  UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  kategori    TEXT NOT NULL DEFAULT 'övrigt'
              CHECK (kategori IN ('arbete', 'material', 'ue', 'övrigt')),
  beskrivning TEXT NOT NULL DEFAULT '',
  belopp      NUMERIC(12,2) DEFAULT 0,
  datum       DATE DEFAULT CURRENT_DATE,
  skapad_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ekonomi_utfall_projekt_id ON ekonomi_utfall(projekt_id);
