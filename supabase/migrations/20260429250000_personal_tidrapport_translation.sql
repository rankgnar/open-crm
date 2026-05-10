-- Översättning av tidrapport-beskrivningar för admin som inte talar
-- alla språk de anställda skriver på (polska, engelska, etc.).
-- Översättningen sker lazy via en AI-assistent med uppgiften
-- 'tidrapport_oversattning' som admin kan redigera under
-- Inställningar → Asistenter (model, prompt, target-språk).

ALTER TABLE personal_tidrapport
  ADD COLUMN IF NOT EXISTS beskrivning_oversatt TEXT,
  ADD COLUMN IF NOT EXISTS beskrivning_sprak TEXT,
  ADD COLUMN IF NOT EXISTS beskrivning_oversatt_at TIMESTAMPTZ;

-- Seed standardassistent för tidrapport-översättning. Idempotent
-- via NOT EXISTS så migrationen är säker att köra om.
INSERT INTO ai_asistenter (
  provider_id, namn, beskrivning, model_id, system_prompt,
  uppgifter, temperature, max_tokens, aktiv, sortering
)
SELECT
  p.id,
  'Översättare för tidrapporter',
  'Översätter anställdas tidrapport-beskrivningar till svenska. Detekterar källspråket automatiskt och returnerar JSON.',
  'claude-haiku-4-5-20251001',
  E'Du är en översättningsassistent för en byggfirmas CRM. Du får ett textstycke från en tidrapport som en anställd har skrivit på fältet.\n\nDin uppgift:\n1. Identifiera källspråket. Returnera ISO 639-1 koden i versaler (t.ex. "SV", "EN", "PL", "ES", "AR", "RO", "UK").\n2. Översätt texten till SVENSKA.\n3. Om texten redan är på svenska, returnera den oförändrad i fältet "oversattning".\n4. Behåll radbrytningar och formatering.\n5. Översätt INTE egennamn, projektnummer eller adresser — lämna dem som de är.\n\nReturnera ENDAST giltig JSON i exakt detta format, ingen extra text, inga markdown-block:\n{"sprak":"<KODEN>","oversattning":"<svenska översättningen>"}',
  ARRAY['tidrapport_oversattning']::TEXT[],
  0.2,
  1024,
  true,
  100
FROM ai_providers p
WHERE p.provider_slug = 'anthropic'
  AND NOT EXISTS (
    SELECT 1 FROM ai_asistenter
    WHERE 'tidrapport_oversattning' = ANY(uppgifter)
  );
