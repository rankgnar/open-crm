-- Workflow: Granska och komplettera förslag
-- Triggered from ForslagDetail (seccion='forslag').
-- Loads the full current förslag, compares against project scope/docs,
-- and ONLY adds missing phases/materials — never deletes or rewrites.

DO $$
DECLARE
  v_provider   uuid;
  v_assistent  uuid;
  v_workflow   uuid;
  v_sys_prompt text;
  v_prompt     text;
BEGIN
  SELECT id INTO v_provider FROM ai_providers WHERE provider_slug = 'openrouter' LIMIT 1;
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'OpenRouter-provider saknas i ai_providers.';
  END IF;

  v_sys_prompt := $SYS$Du är en erfaren byggprojektledare i Sverige. Din uppgift är att granska ett befintligt förslag och ENDAST identifiera tydliga luckor — poster som scope direkt kräver men som inte finns i förslaget. Du lägger aldrig till "nice to have", administrativa poster eller annat som kan diskuteras. Om du är osäker på om något verkligen saknas, utelämnar du det. Du returnerar alltid ren JSON utan kodblock eller förklaringar.$SYS$;

  v_prompt := $TMPL$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS (om tillgänglig — annars tomt):
{{scope_analys}}

DOKUMENTANALYS (om tillgänglig — annars tomt):
{{dokument_analys}}

FÖRSLAG NULÄGE — dessa poster FINNS REDAN, lägg INTE till dem igen:
{{forslag_komplett_text}}

Analysera om det finns poster som TYDLIGT saknas givet projektets scope.
Var konservativ: ta bara med det som scope direkt kräver och som inte redan finns.
Om osäker → inkludera inte.

Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "additions": [
    {
      "fas": "fasnamn (befintligt eller nytt)",
      "subfas": "subfasnamn (befintligt eller nytt)",
      "typ": "material",
      "beskrivning": "kort beskrivning av materialposten",
      "enhet": "st",
      "antal": 1,
      "a_pris": 0,
      "leverantor": ""
    },
    {
      "fas": "fasnamn",
      "subfas": "subfasnamn",
      "typ": "arbete",
      "yrkesroll": "Snickare",
      "antal_timmar": 0,
      "beskrivning": "kort beskrivning av arbetsposten"
    }
  ],
  "kommentar": "kort sammanfattning av vad som lades till och varför (max 200 tecken)",
  "antal_tillagger": 0
}

Regler:
- "fas" och "subfas": använd EXAKT befintliga namn om posten ska under en befintlig fas/subfas
- Om du skapar ny fas: välj ett kort, tydligt namn som passar projekttypen
- MAX 10 poster totalt i "additions"
- Om ingenting saknas → returnera "additions": [], "antal_tillagger": 0
- a_pris sätts till 0 om du inte vet priset — det kan fyllas i manuellt senare$TMPL$;

  -- 1. AI assistant
  INSERT INTO ai_asistenter (
    provider_id, namn, beskrivning, model_id,
    system_prompt, temperature, max_tokens, aktiv, sortering
  )
  SELECT
    v_provider,
    'Förslag-kompletterare',
    'Granskar ett befintligt förslag mot projektets scope och lägger konservativt till poster som tydligt saknas — lägger aldrig till eller skriver om befintligt innehåll.',
    'deepseek/deepseek-chat-v3-0324',
    v_sys_prompt,
    0.2,
    4000,
    true,
    95
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Förslag-kompletterare');

  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'Förslag-kompletterare';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'Assistent "Förslag-kompletterare" kunde inte seedas.';
  END IF;

  -- 2. Workflow
  INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
  SELECT
    'Granska och komplettera förslag',
    'Analyserar ett befintligt förslag mot projektets scope och dokument. Lägger till faser, subfaser, material och arbete som tydligt saknas — utan att röra befintligt innehåll.',
    'forslag',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id', 'n_projekt',  'type', 'data:projekt',           'label', 'Projektdata',              'config', '{}'::jsonb,                                                                'position', 0),
        jsonb_build_object('id', 'n_scope',    'type', 'data:context',           'label', 'Scope-analys',             'config', '{"nyckel":"scope_analys","optional":true}'::jsonb,                         'position', 1),
        jsonb_build_object('id', 'n_dok',      'type', 'data:context',           'label', 'Dokumentanalys',           'config', '{"nyckel":"dokument_analys","optional":true}'::jsonb,                      'position', 2),
        jsonb_build_object('id', 'n_forslag',  'type', 'data:forslag-komplett',  'label', 'Förslag nuläge',           'config', '{}'::jsonb,                                                                'position', 3),
        jsonb_build_object('id', 'n_ai',       'type', 'ai:generate',            'label', 'Identifiera saknade poster','config', jsonb_build_object('assistent_id', v_assistent::text, 'prompt_template', v_prompt), 'position', 4),
        jsonb_build_object('id', 'n_add',      'type', 'action:add-missing-to-forslag', 'label', 'Lägg till saknade poster', 'config', '{}'::jsonb,                                                         'position', 5)
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('from', 'n_projekt', 'to', 'n_scope'),
        jsonb_build_object('from', 'n_scope',   'to', 'n_dok'),
        jsonb_build_object('from', 'n_dok',     'to', 'n_forslag'),
        jsonb_build_object('from', 'n_forslag', 'to', 'n_ai'),
        jsonb_build_object('from', 'n_ai',      'to', 'n_add')
      )
    ),
    true,
    88
  WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE namn = 'Granska och komplettera förslag');

  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Granska och komplettera förslag';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Granska och komplettera förslag" kunde inte seedas.';
  END IF;

  -- 3. Trigger in ForslagDetail (seccion='forslag')
  INSERT INTO workflow_triggers (workflow_id, seccion, etikett, icon, sortering)
  SELECT v_workflow, 'forslag', 'Komplettera förslag', 'PlusCircle', 10
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_triggers WHERE workflow_id = v_workflow AND seccion = 'forslag'
  );

END $$;
