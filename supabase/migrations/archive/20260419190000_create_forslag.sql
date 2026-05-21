CREATE SEQUENCE IF NOT EXISTS forslag_nummer_seq START 1;

CREATE TABLE IF NOT EXISTS forslag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forslag_nummer TEXT UNIQUE,
  projekt_id UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  titel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'utkast'
    CHECK (status IN ('utkast', 'skickat', 'accepterat', 'avvisat')),
  giltig_till DATE,
  moms_procent NUMERIC(5,2) DEFAULT 25,
  sammanfattning TEXT,
  ai_analys TEXT,
  skapad_at TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forslag_projekt_id ON forslag(projekt_id);

CREATE TRIGGER forslag_updated_at
  BEFORE UPDATE ON forslag
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION nextval_forslag_nummer()
RETURNS bigint LANGUAGE sql SECURITY DEFINER
AS $$ SELECT nextval('forslag_nummer_seq') $$;

CREATE OR REPLACE FUNCTION peek_forslag_nummer()
RETURNS bigint LANGUAGE sql SECURITY DEFINER
AS $$ SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM forslag_nummer_seq $$;

CREATE TABLE IF NOT EXISTS forslag_faser (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forslag_id UUID NOT NULL REFERENCES forslag(id) ON DELETE CASCADE,
  namn TEXT NOT NULL DEFAULT '',
  beskrivning TEXT,
  sortering INTEGER DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forslag_faser_forslag_id ON forslag_faser(forslag_id);

CREATE TABLE IF NOT EXISTS forslag_arbetskostnad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fas_id UUID NOT NULL REFERENCES forslag_faser(id) ON DELETE CASCADE,
  beskrivning TEXT NOT NULL DEFAULT '',
  yrkesroll TEXT DEFAULT '',
  antal_timmar NUMERIC(10,2) DEFAULT 0,
  timpris NUMERIC(10,2) DEFAULT 0,
  rot_berattigad BOOLEAN DEFAULT false,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forslag_arbete_fas_id ON forslag_arbetskostnad(fas_id);

CREATE TABLE IF NOT EXISTS forslag_materialkostnad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fas_id UUID NOT NULL REFERENCES forslag_faser(id) ON DELETE CASCADE,
  beskrivning TEXT NOT NULL DEFAULT '',
  enhet TEXT DEFAULT 'st',
  antal NUMERIC(10,2) DEFAULT 0,
  a_pris NUMERIC(10,2) DEFAULT 0,
  leverantor TEXT DEFAULT '',
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forslag_material_fas_id ON forslag_materialkostnad(fas_id);

CREATE TABLE IF NOT EXISTS forslag_subkontraktorer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forslag_id UUID NOT NULL REFERENCES forslag(id) ON DELETE CASCADE,
  namn TEXT NOT NULL DEFAULT '',
  beskrivning TEXT DEFAULT '',
  kostnad NUMERIC(12,2) DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forslag_subkont_forslag_id ON forslag_subkontraktorer(forslag_id);
