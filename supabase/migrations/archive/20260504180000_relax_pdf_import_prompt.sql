-- Two adjustments to the PDF-import workflow seeded in 20260504170000:
--
-- 1. Relax the assistent's system_prompt so the model always attempts
--    extraction. The original rule 4 told it to return
--    {"error":"Ej igenkänt format"} on any layout mismatch, and the model
--    used that escape hatch on the very first real PDF instead of trying.
--
-- 2. Add an action:save-context node between ai:analyze-pdf and
--    action:import-forslag-from-extraction so the AI's structured output
--    is persisted to projekt_context under the key 'importerad_pdf_struktur'.
--    This matches the CREAR-OFER chain pattern: every AI output is
--    captured for traceability and to enable re-running downstream steps
--    without paying for another AI call.
--
-- Both UPDATEs are scoped to the rows seeded by the previous migration —
-- no other assistent or workflow is touched.

-- 1. Relax system_prompt
UPDATE ai_asistenter
SET system_prompt = $PROMPT$Du extraherar struktur från ett färdigt offert-PDF (förslag, preliminär offert, kostnadsförslag — oavsett vilken mall som använts) och returnerar ENBART giltig JSON. Hitta inte på data — om något inte finns i PDF:en, utelämna fältet eller använd null.

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
2. Matcha varje arbete- och materialrad till rätt subfas. Om en rad inte hör till någon subfas (t.ex. står direkt under en fas-rubrik utan subfas-rad), skapa då en subfas med samma namn som fas-raden eller "Allmänt".
3. Datum hämtas från avsnitten "KOMMANDE HÄNDELSER", "TIDPLAN" eller från datumcellen i ARBETSKOSTNAD-tabellen. Skriv alltid YYYY-MM-DD.
4. FÖRSÖK ALLTID extrahera. Var generös med matchning — rubriker kan variera (PRELIMINÄR OFFERT, OFFERT, FÖRSLAG, KOSTNADSFÖRSLAG), kolumnnamn kan skilja, layouten kan vara annorlunda. Acceptera och plocka ut det du hittar. Returnera {"error": "..."} ENBART om PDF:en är helt tom, oläslig (rena bildscanner utan text), eller uppenbart inte är ett offert-dokument (t.ex. en faktura, ett kvitto, en ritning utan priser).
5. Returnera ALDRIG text utanför JSON. Inga ```-block, inga förklaringar, inga inledande meningar.$PROMPT$,
    uppdaterad_at = now()
WHERE namn = 'PDF-import-extraktor';

-- 2. Insert action:save-context node into the workflow definition
DO $$
DECLARE
  v_assistent uuid;
BEGIN
  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'PDF-import-extraktor';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'PDF-import-extraktor saknas — kan inte uppdatera workflow.';
  END IF;

  UPDATE workflows
  SET definition = jsonb_build_object(
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
        'id', 's1',
        'type', 'action:save-context',
        'label', 'Spara extraherad struktur',
        'config', jsonb_build_object(
          'nyckel', 'importerad_pdf_struktur',
          'source_key', 'pdf_analys'
        ),
        'position', 3
      ),
      jsonb_build_object(
        'id', 'a2',
        'type', 'action:import-forslag-from-extraction',
        'label', 'Skapa förslag + tidplan',
        'config', '{}'::jsonb,
        'position', 4
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'd1', 'to', 'd2'),
      jsonb_build_object('from', 'd2', 'to', 'a1'),
      jsonb_build_object('from', 'a1', 'to', 's1'),
      jsonb_build_object('from', 's1', 'to', 'a2')
    )
  ),
  uppdaterad_at = now()
  WHERE namn = 'Importera förslag från PDF';
END $$;
