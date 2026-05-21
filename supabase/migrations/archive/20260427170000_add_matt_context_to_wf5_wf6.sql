-- Fix: WF5 (Estimera arbetskostnad) och WF6 (Estimera materialbehov) konsumerar
-- inte {{matt_och_mangder}} fastän prompt-mallen refererar till nyckeln.
-- Migrationen 20260427160000_create_mattkalkylator_workflow.sql uppdaterade
-- prompt_template men glömde lägga till noden 'data:context' som faktiskt
-- läser nyckeln från projekt_context. Utan noden interpoleras placeholdern
-- till tom sträng → LLM faller tillbaka till att estimera på fri hand.
--
-- Den här migrationen lägger till en 'data:context'-nod (id 'c_matt',
-- nyckel 'matt_och_mangder', optional=true) precis före 'ai:generate'-noden
-- i båda workflows, och kopplar in den i edge-kedjan. optional=true gör att
-- WF5/WF6 fortfarande fungerar för projekt där WF3b inte körts än.

DO $$
DECLARE
  v_def        jsonb;
  v_new_node   jsonb;
  v_new_nodes  jsonb;
  v_new_edges  jsonb;
  v_wf_namn    text;
BEGIN
  v_new_node := jsonb_build_object(
    'id', 'c_matt',
    'type', 'data:context',
    'label', 'Mått och mängder',
    'config', jsonb_build_object('nyckel', 'matt_och_mangder', 'optional', true),
    'position', 5
  );

  FOREACH v_wf_namn IN ARRAY ARRAY['5-Estimera arbetskostnad', '6-Estimera materialbehov']
  LOOP
    SELECT definition INTO v_def FROM workflows WHERE namn = v_wf_namn;
    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Workflow "%" hittades inte', v_wf_namn;
    END IF;

    -- Idempotens: hoppa över om c_matt redan finns
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_def->'nodes') AS n
      WHERE n->>'id' = 'c_matt'
    ) THEN
      CONTINUE;
    END IF;

    -- Bumpa position >= 5 med +1 (motsvarar ai:generate och allt efter)
    -- och lägg till den nya noden sist i arrayen (positionen styr ordningen).
    v_new_nodes := (
      SELECT jsonb_agg(
        CASE WHEN (n->>'position')::int >= 5
             THEN jsonb_set(n, '{position}', to_jsonb((n->>'position')::int + 1))
             ELSE n
        END
      )
      FROM jsonb_array_elements(v_def->'nodes') AS n
    ) || jsonb_build_array(v_new_node);

    -- Omdirigera kanten som går till 'g1' (ai:generate) → 'c_matt',
    -- och lägg till en ny kant 'c_matt' → 'g1'.
    v_new_edges := (
      SELECT jsonb_agg(
        CASE WHEN e->>'to' = 'g1'
             THEN jsonb_set(e, '{to}', '"c_matt"'::jsonb)
             ELSE e
        END
      )
      FROM jsonb_array_elements(v_def->'edges') AS e
    ) || jsonb_build_array(jsonb_build_object('from', 'c_matt', 'to', 'g1'));

    UPDATE workflows
    SET definition  = jsonb_set(jsonb_set(v_def, '{nodes}', v_new_nodes), '{edges}', v_new_edges),
        uppdaterad_at = now()
    WHERE namn = v_wf_namn;
  END LOOP;
END $$;
