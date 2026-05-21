-- Patch: Generera faser från projekt — add context nodes for scope_analys + dokument_analys
-- Updates the workflow created in 20260507150000 to read the outputs of
-- "Analysera projektets scope" (WF1) and "Analysera projektdokument" (WF2)
-- before generating phases. Both context nodes are optional so the workflow
-- still runs standalone if the prior workflows have not been executed.
--
-- New node chain:
--   data:projekt → data:context(scope_analys) → data:context(dokument_analys)
--   → ai:generate → action:create-fas-mall-from-ai

DO $$
DECLARE
  v_assistent   uuid;
  v_workflow    uuid;
  v_prompt_tmpl text;
BEGIN
  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'Fas-generator';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'Fas-generator-assistent saknas — kör 20260507150000 först.';
  END IF;

  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Generera faser från projekt';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Generera faser från projekt" saknas — kör 20260507150000 först.';
  END IF;

  v_prompt_tmpl := $TMPL$Analysera projektet nedan och generera en fasplan för UTFÖRANDEFASEN.

PROJEKT:
- Namn: {{namn}}
- Nummer: {{projekt_nummer}}
- Beskrivning: {{beskrivning}}
- Adress: {{arbetsplats_adress}}, {{arbetsplats_stad}}
- ROT-avdrag: {{rot_avdrag}}
- Budget: {{budget_total}} kr

SCOPE-ANALYS (från föregående steg):
{{scope_analys}}

DOKUMENTANALYS (från föregående steg):
{{dokument_analys}}

REGLER:
1. Enbart utförandefaser — INGA administrativa faser (ej Projektledning, Möten, Fakturering, Administration, Dokumentation).
2. Max 6 faser, max 5 subfaser per fas.
3. Fasordning: förberedelser/rivning → installationer → ytskikt/finish → slutbesiktning om den är fysisk.
4. Subfaser ska vara konkreta arbetsmoment med korta namn (max 4 ord).
5. Om scope-analysen och dokumentanalysen är tomma, utgå från projektnamnet och beskrivningen.
6. mall_namn format: "{{projekt_nummer}} – {{namn}}"

Svara ENBART med giltig JSON, inga förklaringar eller kodblock:
{
  "mall_namn": "P-0123 – Projekttitel",
  "faser": [
    { "namn": "Fas 1", "subfaser": ["Subfas A", "Subfas B"] }
  ]
}$TMPL$;

  UPDATE workflows
  SET definition = jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'n1',
        'type', 'data:projekt',
        'label', 'Ladda projekt',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'c1',
        'type', 'data:context',
        'label', 'Scope-analys',
        'config', jsonb_build_object('nyckel', 'scope_analys', 'optional', true),
        'position', 1
      ),
      jsonb_build_object(
        'id', 'c2',
        'type', 'data:context',
        'label', 'Dokumentanalys',
        'config', jsonb_build_object('nyckel', 'dokument_analys', 'optional', true),
        'position', 2
      ),
      jsonb_build_object(
        'id', 'n2',
        'type', 'ai:generate',
        'label', 'Generera faser',
        'config', jsonb_build_object(
          'assistent_id', v_assistent::text,
          'prompt_template', v_prompt_tmpl
        ),
        'position', 3
      ),
      jsonb_build_object(
        'id', 'n3',
        'type', 'action:create-fas-mall-from-ai',
        'label', 'Skapa fas-mall',
        'config', '{}'::jsonb,
        'position', 4
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'n1', 'to', 'c1'),
      jsonb_build_object('from', 'c1', 'to', 'c2'),
      jsonb_build_object('from', 'c2', 'to', 'n2'),
      jsonb_build_object('from', 'n2', 'to', 'n3')
    )
  )
  WHERE id = v_workflow;
END $$;
