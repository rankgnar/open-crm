-- Add system_kod to ai_asistenter to mark protected system assistants
ALTER TABLE ai_asistenter
  ADD COLUMN IF NOT EXISTS system_kod TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ai_asistenter_system_kod_unique
  ON ai_asistenter (system_kod)
  WHERE system_kod IS NOT NULL;

-- Seed Faktura-parser system assistant
-- Prefers OpenRouter; falls back to the first available provider
DO $$
DECLARE
  v_provider uuid;
  v_assistent uuid;
BEGIN
  SELECT id INTO v_provider FROM ai_providers WHERE provider_slug = 'openrouter' LIMIT 1;
  IF v_provider IS NULL THEN
    SELECT id INTO v_provider FROM ai_providers LIMIT 1;
  END IF;
  IF v_provider IS NULL THEN
    RAISE NOTICE 'No AI provider found — skipping Faktura-parser seed.';
    RETURN;
  END IF;

  INSERT INTO ai_asistenter (
    provider_id, namn, beskrivning, model_id,
    system_prompt, temperature, max_tokens, aktiv, sortering, system_kod
  )
  SELECT
    v_provider,
    'Faktura-parser',
    'Extraherar datum, kategori, beskrivning och belopp från en leverantörsfaktura i PDF-format.',
    CASE
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'openrouter'
        THEN 'anthropic/claude-haiku-4.5'
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'anthropic'
        THEN 'claude-haiku-4-5-20251001'
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'openai'
        THEN 'gpt-4o-mini'
      ELSE 'gemini-2.5-flash'
    END,
    'You extract structured data from supplier invoices. Given invoice content, return ONLY valid JSON with no extra text or code blocks:
{"datum":"YYYY-MM-DD","kategori":"arbete|material|ue|övrigt","beskrivning":"short description in Swedish","belopp":0}

Rules:
- datum: invoice date in YYYY-MM-DD format
- kategori: "arbete" for labor/services, "material" for goods/products, "ue" for subcontractors, "övrigt" for anything else
- beskrivning: concise Swedish description of what was invoiced (max 80 chars)
- belopp: total amount as a number, no currency symbol
- Return ONLY the JSON object. Nothing else.',
    0,
    300,
    true,
    90,
    'kostnader_faktura_parser'
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_asistenter WHERE system_kod = 'kostnader_faktura_parser'
  );

  SELECT id INTO v_assistent FROM ai_asistenter WHERE system_kod = 'kostnader_faktura_parser';
  IF v_assistent IS NULL THEN
    RAISE NOTICE 'Faktura-parser seed failed silently.';
  ELSE
    RAISE NOTICE 'Faktura-parser assistant ready: %', v_assistent;
  END IF;
END $$;
