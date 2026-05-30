-- Knowledge base table for AI assistants
CREATE TABLE IF NOT EXISTS ai_asistent_kunskaper (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assistent_id uuid NOT NULL REFERENCES ai_asistenter(id) ON DELETE CASCADE,
  namn text NOT NULL,
  innehall text NOT NULL,
  aktiv boolean NOT NULL DEFAULT true,
  sortering int NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_asistent_kunskaper_assistent_id_idx
  ON ai_asistent_kunskaper (assistent_id);

-- Seed Fas-revisor system assistant
-- Prefers Anthropic; falls back to OpenRouter or first available provider
DO $$
DECLARE
  v_provider uuid;
  v_assistent uuid;
BEGIN
  SELECT id INTO v_provider FROM ai_providers WHERE provider_slug = 'anthropic' AND aktiv = true LIMIT 1;
  IF v_provider IS NULL THEN
    SELECT id INTO v_provider FROM ai_providers WHERE provider_slug = 'openrouter' AND aktiv = true LIMIT 1;
  END IF;
  IF v_provider IS NULL THEN
    SELECT id INTO v_provider FROM ai_providers LIMIT 1;
  END IF;
  IF v_provider IS NULL THEN
    RAISE NOTICE 'No AI provider found — skipping Fas-revisor seed.';
    RETURN;
  END IF;

  INSERT INTO ai_asistenter (
    provider_id, namn, beskrivning, model_id,
    system_prompt, temperature, max_tokens, aktiv,
    ar_standard, sortering, category, uppgifter, system_kod
  )
  SELECT
    v_provider,
    'Fas-revisor',
    'Expertgranskning av offertfaser inom svensk byggrenovering. Analyserar arbete, material och underentreprenörer och föreslår förbättringar.',
    CASE
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'anthropic'
        THEN 'claude-sonnet-4-6'
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'openrouter'
        THEN 'anthropic/claude-sonnet-4.5'
      WHEN (SELECT provider_slug FROM ai_providers WHERE id = v_provider) = 'openai'
        THEN 'gpt-4o'
      ELSE 'gemini-2.5-flash'
    END,
    'Du är en erfaren expert på byggprojekt och renovering i Sverige med djup kunskap om:
- Byggmaterial, mängdberäkning och prissättning enligt svenska marknadspriser
- Byggnads- och installationsarbeten: stomme, isolering, fasad, tak, fönster, dörrar, badrum, kök, el, VVS, måleri, golvbeläggning
- ROT-avdrag och svenska skatteregler för hantverkstjänster
- Realistiska arbetstidsuppskattningar per yrkesroll (snickare, elektriker, rörläggare, målare, plattsättare)
- Svenska byggbranschen: underentreprenörer, leverantörer, standardpraxis

Du hjälper projektledare att kvalitetsgranska och förbättra enskilda faser i offertunderlag.
Om du har fått en kunskapsbas med priskataloger eller riktlinjer, använd den som referens.

När du granskar en fas:
1. Identifiera poster som verkar onödiga, dubbla eller har orealistiska mängder/priser
2. Föreslå konkreta förbättringar: rätt enhet, rimlig mängd, korrekt beskrivning
3. Flagga om viktiga standardposter saknas för den typen av arbete
4. Håll dig till den valda fasens scope — kommentera inte andra faser

Var konkret och direkt. Svara alltid på svenska.',
    0.4,
    2048,
    true,
    false,
    100,
    'Förslag',
    ARRAY['fas-revisor'],
    'forslag_fas_revisor'
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_asistenter WHERE system_kod = 'forslag_fas_revisor'
  );

  SELECT id INTO v_assistent FROM ai_asistenter WHERE system_kod = 'forslag_fas_revisor';
  IF v_assistent IS NULL THEN
    RAISE NOTICE 'Fas-revisor seed failed silently.';
  ELSE
    RAISE NOTICE 'Fas-revisor assistant ready: %', v_assistent;
  END IF;
END $$;
