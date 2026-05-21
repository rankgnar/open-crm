-- Konsoliderar Förslag-revisor till EN assistent.
--
-- Bakgrund: 20260427180000-migrationen skapade en assistent med exakt namn
-- "Förslag-revisor" (med ö) men det fanns redan en manuellt skapad
-- "Forslag-revisor " (utan ö, med trailing space) i UI:t. Resultat: två
-- assistenter, UI:t visar en, workflow:et pekar på den andra.
--
-- Den här migrationen:
--   1. Hittar bägge assistenterna.
--   2. Konverterar den manuella till canonical form (rätt namn + 16000 tokens,
--      behåller modellen som användaren själv valt).
--   3. Pekar om 8b-Granska förslag workflow:et på den manuella.
--   4. Tar bort min duplikat.
--
-- Idempotent: gör inget om duplikaten redan är borta.

DO $$
DECLARE
  v_mine_id    uuid;
  v_users_id   uuid;
  v_users_name text;
  v_users_model text;
BEGIN
  -- Min duplikat: exact namn 'Förslag-revisor' (med ö, ingen trailing space)
  -- och model_id deepseek/deepseek-v4-pro
  SELECT id INTO v_mine_id
  FROM ai_asistenter
  WHERE namn = 'Förslag-revisor'
    AND model_id = 'deepseek/deepseek-v4-pro';

  -- Användarens assistent: ILIKE på 'forslag%revisor%' eller liknande,
  -- exkluderar min via id-skillnad
  SELECT id, namn, model_id INTO v_users_id, v_users_name, v_users_model
  FROM ai_asistenter
  WHERE (namn ILIKE 'forslag-revisor%' OR namn ILIKE 'förslag-revisor%')
    AND (v_mine_id IS NULL OR id <> v_mine_id)
  LIMIT 1;

  IF v_users_id IS NULL THEN
    RAISE NOTICE 'Ingen användarskapad revisor hittades — hoppar över konsolidering.';
    RETURN;
  END IF;

  -- 1. Repoint workflow till användarens assistent
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'id' = 'n_ai'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_users_id::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  ),
  uppdaterad_at = now()
  WHERE namn = '8b-Granska förslag';

  -- 2. Ta bort min duplikat (om den finns)
  IF v_mine_id IS NOT NULL THEN
    DELETE FROM ai_asistenter WHERE id = v_mine_id;
  END IF;

  -- 3. Normalisera användarens assistent: canonical namn + max_tokens 16000
  UPDATE ai_asistenter
  SET namn = 'Förslag-revisor',
      max_tokens = GREATEST(max_tokens, 16000),
      beskrivning = 'Granskar arbetskostnad och materialkostnad innan de skrivs till förslag. Rättar uppenbara fel i antal/pris/enhet utan att lägga till eller ta bort poster.',
      uppdaterad_at = now()
  WHERE id = v_users_id;

  RAISE NOTICE 'Konsoliderade Förslag-revisor: workflow pekar nu på % (modell: %)', v_users_name, v_users_model;
END $$;
