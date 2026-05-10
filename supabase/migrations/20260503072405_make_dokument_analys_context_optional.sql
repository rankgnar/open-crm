-- Fix: WF3, WF5, WF6 fail with "Ingen kontext hittad för nyckel: dokument_analys"
-- when a project has no images or PDFs.
--
-- WF2 (2-Analysera projektdokument) was hardened in 20260429040000 to skip
-- writing the `dokument_analys` context when there are no documents
-- (skip_if_empty_source=true on its action:save-context). But the downstream
-- workflows still load that key with a `data:context` node where `optional`
-- is false, so the executor throws at workflows.ts:304.
--
-- Same pattern that was applied to `matt_och_mangder` in
-- 20260427170000_add_matt_context_to_wf5_wf6.sql: mark the data:context node
-- as optional so it returns an empty string when the key is missing. The
-- prompt template then sees `DOKUMENTANALYS:` followed by nothing, which
-- mirrors how WF2 already handles missing bilder/PDFs internally.
--
-- WF3b (3b-Beräkna mått och mängder) already has optional=true on its
-- `n_dokument` node and is left untouched.

DO $$
DECLARE
  v_def        jsonb;
  v_new_nodes  jsonb;
  v_wf_namn    text;
  v_node_id    text := 'c2';
BEGIN
  FOREACH v_wf_namn IN ARRAY ARRAY[
    '3-Identifiera projekttyp och faser',
    '5-Estimera arbetskostnad',
    '6-Estimera materialbehov'
  ]
  LOOP
    SELECT definition INTO v_def FROM workflows WHERE namn = v_wf_namn;
    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Workflow "%" hittades inte', v_wf_namn;
    END IF;

    -- Idempotent: if c2 is already optional=true, skip.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_def->'nodes') AS n
      WHERE n->>'id' = v_node_id
        AND n->>'type' = 'data:context'
        AND n->'config'->>'nyckel' = 'dokument_analys'
        AND (n->'config'->>'optional')::boolean IS TRUE
    ) THEN
      RAISE NOTICE 'Workflow "%" already has c2 as optional=true, skipping', v_wf_namn;
      CONTINUE;
    END IF;

    -- Sanity: the c2 node must be data:context with nyckel=dokument_analys.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_def->'nodes') AS n
      WHERE n->>'id' = v_node_id
        AND n->>'type' = 'data:context'
        AND n->'config'->>'nyckel' = 'dokument_analys'
    ) THEN
      RAISE EXCEPTION 'Workflow "%" does not have a data:context node with id=c2 and nyckel=dokument_analys', v_wf_namn;
    END IF;

    v_new_nodes := (
      SELECT jsonb_agg(
        CASE
          WHEN n->>'id' = v_node_id
           AND n->>'type' = 'data:context'
           AND n->'config'->>'nyckel' = 'dokument_analys'
          THEN jsonb_set(n, '{config,optional}', 'true'::jsonb, true)
          ELSE n
        END
      )
      FROM jsonb_array_elements(v_def->'nodes') AS n
    );

    UPDATE workflows
       SET definition = jsonb_set(v_def, '{nodes}', v_new_nodes, false)
     WHERE namn = v_wf_namn;

    RAISE NOTICE 'Workflow "%" — c2 (Dokumentanalys) marked optional=true', v_wf_namn;
  END LOOP;
END $$;
