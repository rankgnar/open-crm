-- Seeds the default "Translator" AI assistant for the SV ↔ ES translator section.
--
-- Prefers Anthropic (haiku); falls back to the first active provider if Anthropic
-- is not configured. Model default is mapped per provider slug.
--
-- Idempotent: WHERE NOT EXISTS guard means re-running is safe and Cloud
-- installations that already have a manually created "Translator" row are unaffected.

DO $$
DECLARE
  v_provider uuid;
  v_slug     text;
  v_model    text;
BEGIN
  SELECT id, provider_slug INTO v_provider, v_slug
  FROM ai_providers WHERE provider_slug = 'anthropic';

  IF v_provider IS NULL THEN
    SELECT id, provider_slug INTO v_provider, v_slug
    FROM ai_providers WHERE aktiv = true ORDER BY sortering LIMIT 1;
  END IF;

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'No AI provider found in ai_providers — cannot seed Translator assistant.';
  END IF;

  v_model := CASE v_slug
    WHEN 'anthropic'  THEN 'claude-haiku-3-5'
    WHEN 'openai'     THEN 'gpt-4o-mini'
    WHEN 'google'     THEN 'gemini-2.5-flash'
    WHEN 'openrouter' THEN 'anthropic/claude-haiku-4.5'
    ELSE 'claude-haiku-3-5'
  END;

  INSERT INTO ai_asistenter (provider_id, namn, model_id, system_prompt, beskrivning, max_tokens, temperature)
  SELECT
    v_provider,
    'Translator',
    v_model,
    'You are a professional translator. When given text to translate, output ONLY the translation — no explanations, no quotes, no preamble.',
    'Personal translator Swedish ↔ Spanish.',
    4096,
    0.1
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Translator');
END $$;
