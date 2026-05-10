-- Workflow: Generera faser från projekt
-- Analyzes a project's name, description, address, ROT status and budget,
-- then asks AI to produce an execution-only phase/subphase structure and
-- saves it as a new fas-mall template in Inställningar → Fas-Subfas.
-- Trigger appears in ProjektDetail (seccion='projekt').

DO $$
DECLARE
  v_anthropic   uuid;
  v_assistent   uuid;
  v_workflow    uuid;
  v_sys_prompt  text;
  v_prompt_tmpl text;
BEGIN
  SELECT id INTO v_anthropic
  FROM ai_providers
  WHERE provider_slug = 'anthropic' AND aktiv = true
  LIMIT 1;

  IF v_anthropic IS NULL THEN
    RAISE EXCEPTION 'Anthropic-provider saknas i ai_providers — kan inte seeda fas-genereringassistent.';
  END IF;

  v_sys_prompt := $SYS$Du är en erfaren projektledare inom bygg- och renovering i Sverige. Du skapar strukturerade fasplaner för byggprojekt baserat på projektets beskrivning och scope. Du returnerar alltid ren JSON utan kodblock eller förklaringar.$SYS$;

  v_prompt_tmpl := $TMPL$Analysera projektet nedan och generera en fasplan för UTFÖRANDEFASEN.

PROJEKT:
- Namn: {{namn}}
- Nummer: {{projekt_nummer}}
- Beskrivning: {{beskrivning}}
- Adress: {{arbetsplats_adress}}, {{arbetsplats_stad}}
- ROT-avdrag: {{rot_avdrag}}
- Budget: {{budget_total}} kr

REGLER:
1. Enbart utförandefaser — INGA administrativa faser (ej Projektledning, Möten, Fakturering, Administration, Dokumentation).
2. Max 6 faser, max 5 subfaser per fas.
3. Fasordning: förberedelser/rivning → installationer → ytskikt/finish → slutbesiktning om den är fysisk.
4. Subfaser ska vara konkreta arbetsmoment med korta namn (max 4 ord).
5. Om beskrivningen är tom, utgå från projektnamnet och adressen för att gissa projekttyp.
6. mall_namn format: "{{projekt_nummer}} – {{namn}}"

Svara ENBART med giltig JSON, inga förklaringar eller kodblock:
{
  "mall_namn": "P-0123 – Projekttitel",
  "faser": [
    { "namn": "Fas 1", "subfaser": ["Subfas A", "Subfas B"] }
  ]
}$TMPL$;

  -- 1. AI assistant
  INSERT INTO ai_asistenter (
    provider_id, namn, beskrivning, model_id,
    system_prompt, temperature, max_tokens, aktiv, sortering
  )
  SELECT
    v_anthropic,
    'Fas-generator',
    'Genererar en utförandefas-struktur (faser + subfaser) för ett byggprojekt och sparar den som en fas-mall i Inställningar.',
    'claude-sonnet-4-6',
    v_sys_prompt,
    0.2,
    3000,
    true,
    90
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Fas-generator');

  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'Fas-generator';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'Fas-generator-assistent kunde inte seedas.';
  END IF;

  -- 2. Workflow: 3 nodes — data:projekt → ai:generate → action:create-fas-mall-from-ai
  INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
  SELECT
    'Generera faser från projekt',
    'Analyserar projektets scope och skapar automatiskt en ny fas-mall med utförandefaser och subfaser i Inställningar → Fas-Subfas.',
    'projekt',
    jsonb_build_object(
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
          'type', 'ai:generate',
          'label', 'Generera faser',
          'config', jsonb_build_object(
            'assistent_id', v_assistent::text,
            'prompt_template', v_prompt_tmpl
          ),
          'position', 1
        ),
        jsonb_build_object(
          'id', 'n3',
          'type', 'action:create-fas-mall-from-ai',
          'label', 'Skapa fas-mall',
          'config', '{}'::jsonb,
          'position', 2
        )
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('from', 'n1', 'to', 'n2'),
        jsonb_build_object('from', 'n2', 'to', 'n3')
      )
    ),
    true,
    10
  WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE namn = 'Generera faser från projekt');

  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Generera faser från projekt';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Generera faser från projekt" kunde inte seedas.';
  END IF;

  -- 3. Trigger in ProjektDetail (seccion='projekt')
  INSERT INTO workflow_triggers (workflow_id, seccion, etikett, icon, sortering)
  SELECT v_workflow, 'projekt', 'Generera faser', 'Layers', 20
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_triggers WHERE workflow_id = v_workflow AND seccion = 'projekt'
  );
END $$;
