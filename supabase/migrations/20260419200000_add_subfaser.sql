-- Drop existing tables that will be restructured (no production data)
DROP TABLE IF EXISTS forslag_materialkostnad;
DROP TABLE IF EXISTS forslag_arbetskostnad;

-- Subfaser: one level below faser, owns arbete + material
CREATE TABLE forslag_subfaser (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fas_id      UUID NOT NULL REFERENCES forslag_faser(id) ON DELETE CASCADE,
  namn        TEXT NOT NULL DEFAULT '',
  beskrivning TEXT,
  sortering   INTEGER DEFAULT 0,
  skapad_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_forslag_subfaser_fas_id ON forslag_subfaser(fas_id);

-- Arbete now belongs to subfas, not fas
CREATE TABLE forslag_arbetskostnad (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subfas_id       UUID NOT NULL REFERENCES forslag_subfaser(id) ON DELETE CASCADE,
  beskrivning     TEXT NOT NULL DEFAULT '',
  yrkesroll       TEXT DEFAULT '',
  antal_timmar    NUMERIC(10,2) DEFAULT 0,
  timpris         NUMERIC(10,2) DEFAULT 0,
  rot_berattigad  BOOLEAN DEFAULT false,
  skapad_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_forslag_arbete_subfas_id ON forslag_arbetskostnad(subfas_id);

-- Material now belongs to subfas, not fas
CREATE TABLE forslag_materialkostnad (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subfas_id   UUID NOT NULL REFERENCES forslag_subfaser(id) ON DELETE CASCADE,
  beskrivning TEXT NOT NULL DEFAULT '',
  enhet       TEXT DEFAULT 'st',
  antal       NUMERIC(10,2) DEFAULT 0,
  a_pris      NUMERIC(10,2) DEFAULT 0,
  leverantor  TEXT DEFAULT '',
  skapad_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_forslag_material_subfas_id ON forslag_materialkostnad(subfas_id);
