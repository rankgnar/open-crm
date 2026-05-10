-- Seed the default AI assistants used by förslagskedje workflows.
--
-- Why this exists: later migrations (20260427130000, 20260427160000)
-- RAISE EXCEPTION when these rows are missing. They existed manually
-- in Cloud Studio but were never captured as a seed migration, so
-- self-hosted installs from scratch failed at this point.
--
-- Idempotent: WHERE NOT EXISTS guards every insert, so Cloud (which
-- already has these rows curated with real prompts) is unaffected,
-- and re-running the migration is safe.
--
-- The values here are minimal placeholders. Actual prompts and model
-- choices are configured by the operator under Inställningar → AI.

DO $$
DECLARE
  v_anthropic uuid;
BEGIN
  SELECT id INTO v_anthropic FROM ai_providers WHERE provider_slug = 'anthropic';
  IF v_anthropic IS NULL THEN
    RAISE EXCEPTION 'Anthropic-provider saknas i ai_providers — kan inte seeda standardassistenter.';
  END IF;

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Scope-analytiker', 'claude-sonnet-4-5',
    'Analyserar projektets scope baserat på inkommande information.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Scope-analytiker');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Dokument-analytiker', 'claude-sonnet-4-5',
    'Analyserar projektdokument (bilder, PDF) och extraherar relevant information.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Dokument-analytiker');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Fasidentifierare', 'claude-sonnet-4-5',
    'Identifierar projekttyp och relevanta faser/subfaser.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Fasidentifierare');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Arbetskostnadsestimator', 'claude-sonnet-4-5',
    'Estimerar arbetskostnad (timmar och yrkesroller) per fas.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Arbetskostnadsestimator');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Materialbehovsestimator', 'claude-sonnet-4-5',
    'Estimerar materialbehov per fas baserat på scope och mått.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Materialbehovsestimator');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Katalogmatchare', 'claude-sonnet-4-5',
    'Matchar materialposter mot intern materialkatalog.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Katalogmatchare');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Webbprisletare', 'claude-sonnet-4-5',
    'Söker materialpriser på webben för poster utan katalogträff.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Webbprisletare');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Tidplansgenerator', 'claude-sonnet-4-5',
    'Genererar tidplan från godkänt förslag.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Tidplansgenerator');

  INSERT INTO ai_asistenter (provider_id, namn, model_id, beskrivning)
  SELECT v_anthropic, 'Måttkalkylator', 'claude-sonnet-4-5',
    'Räknar ut ytor, längder och materialåtgång från scope + dokument.'
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Måttkalkylator');
END $$;
