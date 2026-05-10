-- Fix: Generera faser från projekt — replace stale context nodes with live document read
--
-- Problem: the workflow had data:context(scope_analys) and data:context(dokument_analys)
-- nodes that read cached data from projekt_context (saved by a previous run of WF1/WF2).
-- This made the workflow instant (no AI re-run) and always produced the same old mall.
-- Also, .md and .txt files were never included because data:projekt:dokument-text only
-- reads PDFs.
--
-- Fix: replace the two data:context nodes with data:projekt:text-files, which reads ALL
-- readable documents under the project (PDF + md/txt) fresh from storage every run.
-- The AI prompt now uses {{text_dokument}} as primary source, falling back to project
-- metadata when no documents are uploaded.
--
-- New node chain:
--   data:projekt → data:projekt:text-files → ai:generate → action:create-fas-mall-from-ai

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

PROJEKTDOKUMENT (faser-subfaser.md, ritningar, specifikationer och liknande):
{{text_dokument}}

REGLER:
1. Om ett dokument med faser och subfaser finns bland projektdokumenten — använd det som primär källa för strukturen. Följ det noggrant.
2. Enbart utförandefaser — INGA administrativa faser (ej Projektledning, Möten, Fakturering, Administration, Dokumentation).
3. Max 8 faser, max 6 subfaser per fas.
4. Subfaser ska vara konkreta arbetsmoment med korta namn (max 4 ord).
5. Om inga dokument finns (text_dokument är tomt), utgå från projektnamnet och beskrivningen.
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
        'id', 'n2',
        'type', 'data:projekt:text-files',
        'label', 'Ladda dokument',
        'config', '{}'::jsonb,
        'position', 1
      ),
      jsonb_build_object(
        'id', 'n3',
        'type', 'ai:generate',
        'label', 'Generera faser',
        'config', jsonb_build_object(
          'assistent_id', v_assistent::text,
          'prompt_template', v_prompt_tmpl
        ),
        'position', 2
      ),
      jsonb_build_object(
        'id', 'n4',
        'type', 'action:create-fas-mall-from-ai',
        'label', 'Skapa fas-mall',
        'config', '{}'::jsonb,
        'position', 3
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'n1', 'to', 'n2'),
      jsonb_build_object('from', 'n2', 'to', 'n3'),
      jsonb_build_object('from', 'n3', 'to', 'n4')
    )
  )
  WHERE id = v_workflow;
END $$;
