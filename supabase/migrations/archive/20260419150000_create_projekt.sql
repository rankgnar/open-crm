CREATE SEQUENCE IF NOT EXISTS projekt_nummer_seq START 1;

CREATE TABLE IF NOT EXISTS projekt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_nummer TEXT UNIQUE,
  kund_id UUID NOT NULL REFERENCES kunder(id) ON DELETE CASCADE,
  namn TEXT NOT NULL,
  beskrivning TEXT,
  status TEXT NOT NULL DEFAULT 'planering'
    CHECK (status IN ('planering', 'aktiv', 'pausad', 'klar', 'avbruten')),
  startdatum DATE,
  slutdatum DATE,
  budget_total NUMERIC(12,2) DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projekt_kund_id ON projekt(kund_id);
CREATE INDEX IF NOT EXISTS idx_projekt_status ON projekt(status);

CREATE TRIGGER projekt_updated_at
  BEFORE UPDATE ON projekt
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION nextval_projekt_nummer()
RETURNS bigint LANGUAGE sql SECURITY DEFINER
AS $$ SELECT nextval('projekt_nummer_seq') $$;

CREATE OR REPLACE FUNCTION peek_projekt_nummer()
RETURNS bigint LANGUAGE sql SECURITY DEFINER
AS $$ SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM projekt_nummer_seq $$;
