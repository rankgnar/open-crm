CREATE TABLE ai_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug TEXT NOT NULL CHECK (provider_slug IN ('anthropic', 'openai', 'google', 'ollama')),
  display_name  TEXT NOT NULL DEFAULT '',
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  api_key       TEXT NOT NULL DEFAULT '',
  base_url      TEXT NOT NULL DEFAULT '',
  sortering     INTEGER NOT NULL DEFAULT 0,
  skapad_at     TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider_slug)
);

CREATE TRIGGER ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE ai_asistenter (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  namn          TEXT NOT NULL,
  beskrivning   TEXT NOT NULL DEFAULT '',
  model_id      TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  uppgifter     TEXT[] NOT NULL DEFAULT '{}',
  temperature   NUMERIC NOT NULL DEFAULT 0.7,
  max_tokens    INTEGER NOT NULL DEFAULT 2048,
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  ar_standard   BOOLEAN NOT NULL DEFAULT false,
  sortering     INTEGER NOT NULL DEFAULT 0,
  skapad_at     TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER ai_asistenter_updated_at
  BEFORE UPDATE ON ai_asistenter
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_asistenter_provider_id ON ai_asistenter(provider_id);

INSERT INTO ai_providers (provider_slug, display_name, sortering) VALUES
  ('anthropic', 'Anthropic', 0),
  ('openai',    'OpenAI',    1),
  ('google',    'Google Gemini', 2),
  ('ollama',    'Ollama (lokal)', 3);
