-- Fix: WF för dokumentanalys producerar förorenat innehåll när projektet
-- saknar bilder/PDF-dokument. AI-noderna 'ai:analyze-bilder' och
-- 'ai:analyze-pdf' returnerar nu tom sträng istället för svenskt
-- placeholder-text, men 'ai:generate' kör ändå och hallucinerar ihop ett
-- "underlag". Det resultatet sparas sedan i projekt_context som
-- 'dokument_analys' och förorenar nedströms-workflows.
--
-- Den här migrationen aktiverar de nya skip-flaggorna på workflow-nivå:
--   • ai:generate                                       → skip_if_empty: ['bild_analys', 'pdf_analys']
--   • action:save-context (nyckel='dokument_analys')    → skip_if_empty_source: true
--
-- Workflow identifieras strukturellt: alla workflows som har både ett
-- 'ai:analyze-bilder'-nod och ett 'action:save-context' med
-- nyckel='dokument_analys'. Det gör migrationen okänslig för manuella
-- namnändringar (t.ex. "2-Analysera projektdokument" istället för
-- "Analysera projektdokument").

DO $$
DECLARE
  v_id        uuid;
  v_namn      text;
  v_def       jsonb;
  v_new_nodes jsonb;
  v_count     int := 0;
BEGIN
  FOR v_id, v_namn, v_def IN
    SELECT id, namn, definition
    FROM workflows
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(definition->'nodes') AS n
      WHERE n->>'type' = 'ai:analyze-bilder'
    )
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(definition->'nodes') AS n
      WHERE n->>'type' = 'action:save-context'
        AND (n->'config'->>'nyckel') = 'dokument_analys'
    )
  LOOP
    v_new_nodes := (
      SELECT jsonb_agg(
        CASE
          WHEN n->>'type' = 'ai:generate' THEN
            jsonb_set(
              n,
              '{config}',
              COALESCE(n->'config', '{}'::jsonb) || jsonb_build_object(
                'skip_if_empty', jsonb_build_array('bild_analys', 'pdf_analys')
              )
            )
          WHEN n->>'type' = 'action:save-context'
               AND (n->'config'->>'nyckel') = 'dokument_analys' THEN
            jsonb_set(
              n,
              '{config}',
              COALESCE(n->'config', '{}'::jsonb) || jsonb_build_object('skip_if_empty_source', true)
            )
          ELSE n
        END
      )
      FROM jsonb_array_elements(v_def->'nodes') AS n
    );

    UPDATE workflows
    SET definition    = jsonb_set(v_def, '{nodes}', v_new_nodes),
        uppdaterad_at = now()
    WHERE id = v_id;

    RAISE NOTICE 'Uppdaterade workflow: %', v_namn;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Hittade inget workflow med ai:analyze-bilder + save-context(dokument_analys)';
  END IF;
END $$;
