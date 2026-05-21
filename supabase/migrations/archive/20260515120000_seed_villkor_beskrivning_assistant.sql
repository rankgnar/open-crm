-- Seed default assistant for AI-generated project descriptions prepended to villkor text.
-- The user can edit model, parameters and system_prompt in Installningar → Assistenter.
-- Idempotent: only inserts if no assistant with uppgift 'villkor-beskrivning' exists.

INSERT INTO ai_asistenter (
  provider_id, namn, beskrivning, model_id, system_prompt,
  uppgifter, temperature, max_tokens, aktiv, sortering
)
SELECT
  p.id,
  'Villkor-beskrivning',
  'Generates a short project description (3–5 sentences) to prepend to the villkor text in a förslag.',
  'openai/gpt-4o-mini',
  E'Du är en assistent som skriver korta projektbeskrivningar för att inkluderas i början av avtalsvillkor.\n\nDu får information om ett projekt och ett förslag. Generera EN kortfattad beskrivning (3–5 meningar) på svenska som sammanfattar arbetets omfattning: vad som ska göras, var och för vem.\n\nRegler:\n- Skriv på professionell och neutral svenska\n- Inkludera inte priser, datum eller betalningsvillkor\n- Inga rubriker, listor eller markdown — bara löpande text\n- Max 5 meningar',
  ARRAY['villkor-beskrivning']::TEXT[],
  0.4,
  512,
  true,
  120
FROM ai_providers p
WHERE p.provider_slug = 'openrouter'
  AND NOT EXISTS (
    SELECT 1 FROM ai_asistenter
    WHERE 'villkor-beskrivning' = ANY(uppgifter)
  );
