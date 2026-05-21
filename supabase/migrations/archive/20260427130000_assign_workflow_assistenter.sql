-- Tilldelar AI-assistenter till noderna i de 10 förslagskedje-workflowsen.
-- Lookup sker via ai_asistenter.namn så vi inte hårdkodar UUID:er.
-- Endast nodernas config.assistent_id ändras — allt annat (label, prompt_template, edges) bevaras.

DO $$
DECLARE
  v_scope     uuid;
  v_dokument  uuid;
  v_fas       uuid;
  v_arbete    uuid;
  v_material  uuid;
  v_katalog   uuid;
  v_webb      uuid;
  v_tidplan   uuid;
BEGIN
  SELECT id INTO v_scope    FROM ai_asistenter WHERE namn = 'Scope-analytiker';
  SELECT id INTO v_dokument FROM ai_asistenter WHERE namn = 'Dokument-analytiker';
  SELECT id INTO v_fas      FROM ai_asistenter WHERE namn = 'Fasidentifierare';
  SELECT id INTO v_arbete   FROM ai_asistenter WHERE namn = 'Arbetskostnadsestimator';
  SELECT id INTO v_material FROM ai_asistenter WHERE namn = 'Materialbehovsestimator';
  SELECT id INTO v_katalog  FROM ai_asistenter WHERE namn = 'Katalogmatchare';
  SELECT id INTO v_webb     FROM ai_asistenter WHERE namn = 'Webbprisletare';
  SELECT id INTO v_tidplan  FROM ai_asistenter WHERE namn = 'Tidplansgenerator';

  IF v_scope IS NULL OR v_dokument IS NULL OR v_fas IS NULL OR v_arbete IS NULL
     OR v_material IS NULL OR v_katalog IS NULL OR v_webb IS NULL OR v_tidplan IS NULL THEN
    RAISE EXCEPTION 'Saknar AI-assistent i ai_asistenter. Kontrollera att alla 8 finns med exakt namn (Scope-analytiker, Dokument-analytiker, Fasidentifierare, Arbetskostnadsestimator, Materialbehovsestimator, Katalogmatchare, Webbprisletare, Tidplansgenerator).';
  END IF;

  -- WF1: alla ai:*-noder → Scope-analytiker
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_scope::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '1-Analysera projektets scope';

  -- WF2: alla ai:*-noder (analyze-bilder, analyze-pdf, generate) → Dokument-analytiker
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_dokument::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '2-Analysera projektdokument';

  -- WF3: alla ai:*-noder → Fasidentifierare
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_fas::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '3-Identifiera projekttyp och faser';

  -- WF4: ingen AI, hoppas över

  -- WF5: alla ai:*-noder → Arbetskostnadsestimator
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_arbete::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '5-Estimera arbetskostnad';

  -- WF6: alla ai:*-noder → Materialbehovsestimator
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_material::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '6-Estimera materialbehov';

  -- WF7: action:match-material-katalog → Katalogmatchare
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' = 'action:match-material-katalog'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_katalog::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '7-Matcha material mot katalog';

  -- WF8: action:search-web-price → Webbprisletare
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' = 'action:search-web-price'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_webb::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '8-Sök materialpris på webben';

  -- WF9: ingen AI, hoppas över

  -- WF10: alla ai:*-noder → Tidplansgenerator
  UPDATE workflows
  SET definition = jsonb_set(
    definition, '{nodes}',
    (SELECT jsonb_agg(
      CASE WHEN node->>'type' LIKE 'ai:%'
           THEN jsonb_set(node, '{config,assistent_id}', to_jsonb(v_tidplan::text))
           ELSE node END
    ) FROM jsonb_array_elements(definition->'nodes') AS node)
  )
  WHERE namn = '10-Generera tidplan från förslag';
END $$;
