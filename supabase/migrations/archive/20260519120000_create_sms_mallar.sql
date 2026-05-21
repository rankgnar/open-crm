CREATE TABLE sms_mallar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  meddelande TEXT NOT NULL DEFAULT '',
  aktiv BOOLEAN NOT NULL DEFAULT true,
  sortering INTEGER NOT NULL DEFAULT 0,
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER sms_mallar_updated_at
  BEFORE UPDATE ON sms_mallar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
