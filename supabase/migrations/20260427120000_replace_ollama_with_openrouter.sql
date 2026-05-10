-- Tar bort ev. assistenter som använder Ollama (FK är ON DELETE RESTRICT)
DELETE FROM ai_asistenter
WHERE provider_id IN (SELECT id FROM ai_providers WHERE provider_slug = 'ollama');

DELETE FROM ai_providers WHERE provider_slug = 'ollama';

ALTER TABLE ai_providers DROP CONSTRAINT IF EXISTS ai_providers_provider_slug_check;

ALTER TABLE ai_providers ADD CONSTRAINT ai_providers_provider_slug_check
  CHECK (provider_slug IN ('anthropic', 'openai', 'google', 'openrouter'));

INSERT INTO ai_providers (provider_slug, display_name, sortering)
VALUES ('openrouter', 'OpenRouter', 3)
ON CONFLICT (provider_slug) DO NOTHING;
