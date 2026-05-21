-- Seed default assistant for AI-generated client questionnaire forms.
-- The user can edit model, parameters and system_prompt in Installningar → AI.
-- Idempotent: only inserts if no assistant with uppgift 'frageblankett' exists.

INSERT INTO ai_asistenter (
  provider_id, namn, beskrivning, model_id, system_prompt,
  uppgifter, temperature, max_tokens, aktiv, sortering
)
SELECT
  p.id,
  'Formulärgenerator',
  'Genererar strukturerade formulär (JSON) från en lista med frågor i fritext. Används av Projekt → Frågor-fliken.',
  'claude-haiku-4-5-20251001',
  E'You are a structured form builder for a Swedish construction CRM.\nGiven a list of questions, return a JSON array of form fields.\nEach element must have this exact shape:\n{ "id": "q1", "label": "...", "type": "text|textarea|number|select|date|boolean", "required": true, "options": null }\nRules:\n- Dimensions / measurements → "text"\n- Yes/No questions → "boolean"\n- Numeric quantities → "number"\n- Multiple fixed choices → "select" with non-null "options" array\n- Open-ended descriptions → "textarea"\n- Dates → "date"\n- Use incremental ids: q1, q2, q3 ...\n- Set "required": true for all fields\nOutput ONLY the JSON array. No explanation. No markdown fences.',
  ARRAY['frageblankett']::TEXT[],
  0.2,
  2048,
  true,
  110
FROM ai_providers p
WHERE p.provider_slug = 'anthropic'
  AND NOT EXISTS (
    SELECT 1 FROM ai_asistenter
    WHERE 'frageblankett' = ANY(uppgifter)
  );
