-- Secuencia para personal_nummer
CREATE SEQUENCE IF NOT EXISTS personal_nummer_seq START 1;

CREATE OR REPLACE FUNCTION nextval_personal_nummer()
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT nextval('personal_nummer_seq');
$$;

-- Tabla principal de empleados
CREATE TABLE personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_nummer TEXT UNIQUE NOT NULL,
  fortnox_id TEXT UNIQUE,
  namn TEXT NOT NULL,
  personnummer TEXT,
  roll TEXT,
  personaltyp TEXT,
  loneform TEXT,
  anstallningsform TEXT,
  email TEXT,
  telefon TEXT,
  postadress TEXT,
  postnummer TEXT,
  ort TEXT,
  anstallningsdatum DATE,
  slutdatum DATE,
  "manadslön" NUMERIC(12,2),
  "timlön" NUMERIC(10,2),
  sysselsattningsgrad NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'aktiv',
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal (status);
CREATE INDEX ON personal (fortnox_id);
CREATE INDEX ON personal (personnummer);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_personal_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.uppdaterad_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personal_updated_at
  BEFORE UPDATE ON personal
  FOR EACH ROW EXECUTE FUNCTION update_personal_updated_at();

-- Anteckningar
CREATE TABLE personal_anteckningar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  titel TEXT NOT NULL DEFAULT '',
  innehall TEXT NOT NULL DEFAULT '',
  farg TEXT NOT NULL DEFAULT 'muted',
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal_anteckningar (personal_id);

-- Dokument
CREATE TABLE personal_dokument (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  filnamn TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storlek BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal_dokument (personal_id);

-- Ledighet (vacaciones, ausencias)
CREATE TABLE personal_ledighet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  typ TEXT NOT NULL,
  startdatum DATE NOT NULL,
  slutdatum DATE NOT NULL,
  godkand BOOLEAN NOT NULL DEFAULT false,
  kommentar TEXT,
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal_ledighet (personal_id);

-- Tidrapport (registro de horas)
CREATE TABLE personal_tidrapport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  timmar NUMERIC(5,2) NOT NULL,
  typ TEXT NOT NULL DEFAULT 'normal',
  beskrivning TEXT,
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal_tidrapport (personal_id);
CREATE INDEX ON personal_tidrapport (datum);
