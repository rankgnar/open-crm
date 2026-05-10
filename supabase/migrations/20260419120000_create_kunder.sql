CREATE TABLE IF NOT EXISTS kunder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  adress TEXT,
  stad TEXT,
  postnummer TEXT,
  org_nummer TEXT,
  status TEXT NOT NULL DEFAULT 'potentiell'
    CHECK (status IN ('aktiv', 'inaktiv', 'potentiell')),
  skapad_at TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kunder_status ON kunder(status);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.uppdaterad_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kunder_updated_at
  BEFORE UPDATE ON kunder
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
