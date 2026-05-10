CREATE TABLE ai_funktioner (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn            TEXT NOT NULL,
  beskrivning     TEXT NOT NULL DEFAULT '',
  prompt_template TEXT NOT NULL DEFAULT '',
  input_variabler TEXT NOT NULL DEFAULT '',
  assistent_id    UUID REFERENCES ai_asistenter(id) ON DELETE SET NULL,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  sortering       INTEGER NOT NULL DEFAULT 0,
  skapad_at       TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER ai_funktioner_updated_at
  BEFORE UPDATE ON ai_funktioner
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_funktioner_sortering ON ai_funktioner(sortering);
