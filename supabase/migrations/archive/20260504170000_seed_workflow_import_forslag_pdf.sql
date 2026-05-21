-- Workflow: Importera förslag från PDF (personal use)
-- Reads a PDF uploaded under projekt_dokument, asks AI to extract its
-- structured offer (header + faser/subfaser/arbete/material/dates),
-- and writes the entire tree verbatim to forslag/faser/subfaser/
-- arbete/material plus kalender_events. Does NOT touch any existing
-- workflow, assistent, or trigger.

DO $$
DECLARE
  v_anthropic   uuid;
  v_assistent   uuid;
  v_workflow    uuid;
BEGIN
  SELECT id INTO v_anthropic FROM ai_providers WHERE provider_slug = 'anthropic';
  IF v_anthropic IS NULL THEN
    RAISE EXCEPTION 'Anthropic-provider saknas i ai_providers — kan inte seeda PDF-importassistent.';
  END IF;

  -- 1. Assistent: dedicated to PDF→JSON extraction
  INSERT INTO ai_asistenter (
    provider_id, namn, beskrivning, model_id,
    system_prompt, temperature, max_tokens, aktiv, sortering
  )
  SELECT
    v_anthropic,
    'PDF-import-extraktor',
    'Extraherar struktur (faser, subfaser, arbete, material, datum) från ett befintligt förslag i PDF-format till strikt JSON.',
    'claude-sonnet-4-5',
    $PROMPT$Du extraherar struktur från ett färdigt offert-PDF (förslag/preliminär offert) och returnerar ENBART giltig JSON. Hitta inte på data — om något inte finns i PDF:en, utelämna fältet eller använd null.

Returnera EXAKT detta schema (inga kommentarer, inga kodblock, ren JSON):

{
  "header": {
    "titel": string,                        // projektets titel/uppdrag, ex. "Fasadrenovering garage"
    "datum": "YYYY-MM-DD",                  // offertens utfärdandedatum
    "giltig_dagar": number,                 // ex. 30
    "moms_procent": number,                 // ex. 25
    "rot_avdrag": boolean,                  // true om PDF nämner att ROT tillämpas, annars false
    "ursprung_nummer": string|null          // ex. "F-257" om PDF har ett projekt-/offertnummer
  },
  "faser": [
    {
      "namn": string,                       // exakt som i PDF, t.ex. "FAS 2 RIVNING OCH DEMONTERING"
      "sortering": number,                  // 0,1,2,... i den ordning faserna förekommer
      "subfaser": [
        {
          "namn": string,                   // titeln på subfasen i PDF (rad ovanför arbete-tabellen)
          "sortering": number,              // 0,1,2,... inom fasen
          "start_datum": "YYYY-MM-DD"|null, // från schema/tidplan om tillgängligt
          "slut_datum":  "YYYY-MM-DD"|null,
          "arbete": [
            {
              "beskrivning": string,        // text-raden från ARBETSKOSTNAD-tabellen (rubrik + ev. underrad)
              "yrkesroll": string,          // gissa rimlig svensk yrkesroll (Snickare/Markarbetare/Fasadarbetare/Plåtslagare/Städare/Övrigt) baserat på arbetstypen
              "antal_timmar": number,       // kolumnen TIMMAR (faktureringstimmar; om - eller 0, sätt 0)
              "timpris": number,            // kolumnen À-PRIS (numeriskt, utan "SEK/h")
              "rot_berattigad": boolean     // false om header.rot_avdrag är false; annars utgå från PDF
            }
          ],
          "material": [
            {
              "beskrivning": string,        // raden i MATERIALKOSTNAD-tabellen
              "enhet": string,              // st, m, m2, m3, kg, liter, ...
              "antal": number,              // kolumnen ANTAL (decimaler tillåtna)
              "a_pris": number,             // kolumnen À-PRIS (numeriskt)
              "leverantor": string          // tom sträng om ej angivet
            }
          ]
        }
      ]
    }
  ]
}

REGLER:
1. Använd PDF:ens exakta namn på faser och subfaser — översätt eller normalisera ingenting.
2. Matcha varje arbete- och materialrad till rätt subfas. Om en rad i ARBETSKOSTNAD eller MATERIALKOSTNAD inte hör till någon subfas (t.ex. "AVFALLHANTERING" som står direkt under en fas-rubrik utan subfas), skapa då en subfas med samma namn som fas-raden eller "Allmänt".
3. Datum hämtas från avsnitten "KOMMANDE HÄNDELSER", "TIDPLAN" eller från datumcellen i ARBETSKOSTNAD-tabellen. Skriv alltid YYYY-MM-DD.
4. Om PDF:en inte är ett förslag/offert-dokument: returnera {"error": "Ej igenkänt format"}.
5. Returnera ALDRIG text utanför JSON. Inga ```-block, inga förklaringar.$PROMPT$,
    0,
    15000,
    true,
    100
  WHERE NOT EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'PDF-import-extraktor');

  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'PDF-import-extraktor';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'PDF-import-extraktor kunde inte seedas.';
  END IF;

  -- 2. Workflow: 4 nodes — projekt + dokument + analyze-pdf + import-from-extraction
  INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
  SELECT
    'Importera förslag från PDF',
    'Läser ett färdigt offert-PDF som laddats upp på projektet, extraherar dess struktur via AI och skapar ett komplett förslag (faser, subfaser, arbete, material) plus kalenderhändelser för tidplanen. Avsedd för att flytta in gamla offerter från en annan app.',
    'forslag',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object(
          'id', 'd1',
          'type', 'data:projekt',
          'label', 'Projektdata',
          'config', '{}'::jsonb,
          'position', 0
        ),
        jsonb_build_object(
          'id', 'd2',
          'type', 'data:projekt:dokument',
          'label', 'Hämta projektfiler',
          'config', '{}'::jsonb,
          'position', 1
        ),
        jsonb_build_object(
          'id', 'a1',
          'type', 'ai:analyze-pdf',
          'label', 'AI — Extrahera offertstruktur',
          'config', jsonb_build_object(
            'assistent_id', v_assistent::text,
            'prompt', 'Extrahera detta förslag enligt schemat i din systeminstruktion. Returnera ENBART JSON.'
          ),
          'position', 2
        ),
        jsonb_build_object(
          'id', 'a2',
          'type', 'action:import-forslag-from-extraction',
          'label', 'Skapa förslag + tidplan',
          'config', '{}'::jsonb,
          'position', 3
        )
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('from', 'd1', 'to', 'd2'),
        jsonb_build_object('from', 'd2', 'to', 'a1'),
        jsonb_build_object('from', 'a1', 'to', 'a2')
      )
    ),
    true,
    5
  WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE namn = 'Importera förslag från PDF');

  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Importera förslag från PDF';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Importera förslag från PDF" kunde inte seedas.';
  END IF;

  -- 3. Trigger: rendered inside the Dokument panel of a projekt,
  -- next to the "Ladda upp" button (synthetic sub-section).
  INSERT INTO workflow_triggers (workflow_id, seccion, etikett, icon, sortering)
  SELECT v_workflow, 'projekt:dokument', 'Importera från PDF', 'Upload', 10
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_triggers WHERE workflow_id = v_workflow AND seccion = 'projekt:dokument'
  );
END $$;
