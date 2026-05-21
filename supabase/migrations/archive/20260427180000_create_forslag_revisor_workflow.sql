-- Skapar revisor-agenten + workflow:et "8b-Granska förslag" som ligger mellan
-- WF8 (Sök materialpris på webben) och WF9 (Fyll i förslag med kostnader).
--
-- Revisor läser:
--   - matt_och_mangder (från WF3b, optional)
--   - arbetskostnad_urval (från WF5)
--   - materialkostnad_urval (från WF7)
--   - material_webb_urval (från WF8)
-- och returnerar samma listor med ev. fältkorrigeringar (a_pris, antal, enhet).
-- Korrigerade listor skrivs tillbaka till projekt_context, så WF9 läser dem
-- transparent. Hela revisionen sparas dessutom som "forslag_revision" för audit.
--
-- Provider: openrouter, modell: deepseek/deepseek-v4-pro, temperature: 0.0.

DO $$
DECLARE
  v_provider_id uuid;
  v_revisor_id  uuid;
  v_wf_id       uuid;
  v_prompt_mall text;
  v_definition  jsonb;
  v_system      text;
  v_wf8_id      uuid;
  v_wf9_id      uuid;
BEGIN
  -- ── 1. Skapa eller hitta revisor-assistenten ──────────────────────────────
  SELECT id INTO v_provider_id FROM ai_providers WHERE provider_slug = 'openrouter';
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'OpenRouter-provider saknas i ai_providers.';
  END IF;

  v_system := $sys$Du är Förslag-revisor — en granskningsagent som inspekterar arbetskostnads- och materialkostnadslistor INNAN de skrivs till en förslagsdatabas.

Din ENDA uppgift är att hitta och rätta uppenbara fel:
- antal × a_pris ger orimligt resultat (t.ex. en brunnsmanschett som "kostar" 4 349 kr)
- enhet är fel (t.ex. "kr" eller "förp" där "m²"/"m" förväntas)
- antal stämmer inte med MÅTT OCH MÄNGDER (om de medskickats)
- a_pris ligger utanför rimligt intervall för svensk byggmarknad 2026
- duplicerad post (samma material i samma fas+subfas två gånger)

REGLER (icke förhandlingsbara):
- Lägg ALDRIG till nya poster.
- Ta ALDRIG bort poster (även dubbletter — flagga, men rätta inte bort dem).
- Om du är osäker → lämna posten exakt som den var.
- Du rättar ENDAST fält: antal, a_pris, enhet, beskrivning, antal_timmar.
- Du ändrar ALDRIG: fas, subfas, yrkesroll, leverantor, sokterm, katalog_id, artikel_nummer.
- Returnera ENBART giltig JSON. Ingen text utanför JSON.$sys$;

  IF EXISTS (SELECT 1 FROM ai_asistenter WHERE namn = 'Förslag-revisor') THEN
    UPDATE ai_asistenter
    SET provider_id  = v_provider_id,
        model_id     = 'deepseek/deepseek-v4-pro',
        system_prompt = v_system,
        beskrivning  = 'Granskar arbetskostnad och materialkostnad innan de skrivs till förslag. Rättar uppenbara fel i antal/pris/enhet utan att lägga till eller ta bort poster.',
        temperature  = 0.0,
        max_tokens   = 4000,
        aktiv        = true
    WHERE namn = 'Förslag-revisor'
    RETURNING id INTO v_revisor_id;
  ELSE
    INSERT INTO ai_asistenter (provider_id, namn, beskrivning, model_id, system_prompt, temperature, max_tokens, aktiv)
    VALUES (
      v_provider_id,
      'Förslag-revisor',
      'Granskar arbetskostnad och materialkostnad innan de skrivs till förslag. Rättar uppenbara fel i antal/pris/enhet utan att lägga till eller ta bort poster.',
      'deepseek/deepseek-v4-pro',
      v_system,
      0.0,
      4000,
      true
    )
    RETURNING id INTO v_revisor_id;
  END IF;

  -- ── 2. Bygg prompt-mall ────────────────────────────────────────────────────
  v_prompt_mall := $prompt$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

MÅTT OCH MÄNGDER (referens — om tomt finns inga förberäknade mått):
{{matt_och_mangder}}

ARBETSKOSTNAD ATT GRANSKA:
{{arbetskostnad_urval}}

MATERIALKOSTNAD (KATALOG) ATT GRANSKA:
{{materialkostnad_urval}}

MATERIALKOSTNAD (WEBB) ATT GRANSKA:
{{material_webb_urval}}

Granska listorna ovan och returnera korrigerade versioner. Returnera ENBART JSON enligt mall:
{
  "arbete_korrigerad": {
    "estimat": [ /* samma struktur som ARBETSKOSTNAD.estimat — kopiera oförändrat om inget ska rättas */ ],
    "total_timmar": 0,
    "osakerhet": "lag/medel/hog",
    "kommentar": "..."
  },
  "material_korrigerad": [ /* samma längd och struktur som MATERIALKOSTNAD (KATALOG) */ ],
  "material_webb_korrigerad": [ /* samma längd och struktur som MATERIALKOSTNAD (WEBB) */ ],
  "korrigeringar": [
    {
      "lista": "arbete" | "material" | "material_webb",
      "index": 0,
      "falt": "a_pris",
      "fran": 4349,
      "till": 350,
      "motivering": "Brunnsmanschett kostar 200–400 kr i svensk marknad, inte 4349 kr"
    }
  ],
  "antal_korrigeringar": 0,
  "kommentar": "Övergripande kommentar om granskningen"
}

VIKTIGT:
- arbete_korrigerad.estimat ska ha EXAKT samma antal poster som ARBETSKOSTNAD.estimat
- material_korrigerad ska ha EXAKT samma antal poster som MATERIALKOSTNAD (KATALOG)
- material_webb_korrigerad ska ha EXAKT samma antal poster som MATERIALKOSTNAD (WEBB)
- Om en post inte ska rättas → kopiera den oförändrad (alla fält bevaras)
- Om input-listan är tom → returnera tom lista i motsvarande korrigerad-fält$prompt$;

  -- ── 3. Bygg definition-JSON med 8 noder ───────────────────────────────────
  v_definition := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'n_projekt',
        'type', 'data:projekt',
        'label', 'Hämta projektdata',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'n_matt',
        'type', 'data:context',
        'label', 'Hämta mått och mängder',
        'config', jsonb_build_object('nyckel', 'matt_och_mangder', 'optional', true),
        'position', 1
      ),
      jsonb_build_object(
        'id', 'n_arbete',
        'type', 'data:context',
        'label', 'Hämta arbetskostnad',
        'config', jsonb_build_object('nyckel', 'arbetskostnad_urval'),
        'position', 2
      ),
      jsonb_build_object(
        'id', 'n_material',
        'type', 'data:context',
        'label', 'Hämta materialkostnad (katalog)',
        'config', jsonb_build_object('nyckel', 'materialkostnad_urval'),
        'position', 3
      ),
      jsonb_build_object(
        'id', 'n_material_webb',
        'type', 'data:context',
        'label', 'Hämta materialkostnad (webb)',
        'config', jsonb_build_object('nyckel', 'material_webb_urval', 'optional', true),
        'position', 4
      ),
      jsonb_build_object(
        'id', 'n_ai',
        'type', 'ai:generate',
        'label', 'Granska kostnader',
        'config', jsonb_build_object(
          'assistent_id', v_revisor_id::text,
          'prompt_template', v_prompt_mall
        ),
        'position', 5
      ),
      jsonb_build_object(
        'id', 'n_save_arbete',
        'type', 'action:save-context',
        'label', 'Spara korrigerad arbetskostnad',
        'config', jsonb_build_object('nyckel', 'arbetskostnad_urval', 'source_key', 'ai_output.arbete_korrigerad'),
        'position', 6
      ),
      jsonb_build_object(
        'id', 'n_save_material',
        'type', 'action:save-context',
        'label', 'Spara korrigerad materialkostnad',
        'config', jsonb_build_object('nyckel', 'materialkostnad_urval', 'source_key', 'ai_output.material_korrigerad'),
        'position', 7
      ),
      jsonb_build_object(
        'id', 'n_save_material_webb',
        'type', 'action:save-context',
        'label', 'Spara korrigerad materialkostnad (webb)',
        'config', jsonb_build_object('nyckel', 'material_webb_urval', 'source_key', 'ai_output.material_webb_korrigerad'),
        'position', 8
      ),
      jsonb_build_object(
        'id', 'n_save_revision',
        'type', 'action:save-context',
        'label', 'Spara revisionslogg',
        'config', jsonb_build_object('nyckel', 'forslag_revision', 'source_key', 'ai_output'),
        'position', 9
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'n_projekt',        'to', 'n_matt'),
      jsonb_build_object('from', 'n_matt',           'to', 'n_arbete'),
      jsonb_build_object('from', 'n_arbete',         'to', 'n_material'),
      jsonb_build_object('from', 'n_material',       'to', 'n_material_webb'),
      jsonb_build_object('from', 'n_material_webb',  'to', 'n_ai'),
      jsonb_build_object('from', 'n_ai',             'to', 'n_save_arbete'),
      jsonb_build_object('from', 'n_save_arbete',    'to', 'n_save_material'),
      jsonb_build_object('from', 'n_save_material',  'to', 'n_save_material_webb'),
      jsonb_build_object('from', 'n_save_material_webb', 'to', 'n_save_revision')
    )
  );

  -- ── 4. INSERT/UPDATE workflow:et ──────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM workflows WHERE namn = '8b-Granska förslag') THEN
    UPDATE workflows
    SET definition = v_definition,
        beskrivning = 'Granskar arbetskostnad_urval, materialkostnad_urval och material_webb_urval innan de skrivs till förslag. Rättar uppenbara fel (pris/antal/enhet) och skriver tillbaka korrigerade listor. WF9 läser dem transparent.',
        uppdaterad_at = now()
    WHERE namn = '8b-Granska förslag'
    RETURNING id INTO v_wf_id;
  ELSE
    INSERT INTO workflows (namn, beskrivning, kategori, definition, version, aktiv, sortering)
    VALUES (
      '8b-Granska förslag',
      'Granskar arbetskostnad_urval, materialkostnad_urval och material_webb_urval innan de skrivs till förslag. Rättar uppenbara fel (pris/antal/enhet) och skriver tillbaka korrigerade listor. WF9 läser dem transparent.',
      'forslag',
      v_definition,
      1,
      true,
      85
    )
    RETURNING id INTO v_wf_id;
  END IF;

  -- ── 5. Injicera WF8b mellan WF8 och WF9 i alla sequences som har båda ────
  SELECT id INTO v_wf8_id FROM workflows WHERE namn = '8-Sök materialpris på webben';
  SELECT id INTO v_wf9_id FROM workflows WHERE namn = '9-Fyll i förslag med kostnader';

  IF v_wf8_id IS NULL OR v_wf9_id IS NULL THEN
    RAISE NOTICE 'WF8 eller WF9 hittades inte med förväntade namn — hoppar över sequence-uppdatering. Lägg till WF8b manuellt i sekvensen.';
  ELSE
    UPDATE workflow_sequences
    SET workflow_ids = (
      SELECT jsonb_agg(elem ORDER BY ord)
      FROM (
        SELECT ord, elem
        FROM jsonb_array_elements_text(workflow_ids) WITH ORDINALITY AS t(elem, ord)
        UNION ALL
        SELECT
          (SELECT ord + 0.5 FROM jsonb_array_elements_text(workflow_ids) WITH ORDINALITY AS t(elem, ord) WHERE elem = v_wf8_id::text),
          v_wf_id::text
      ) AS combined
    )
    WHERE workflow_ids @> to_jsonb(v_wf8_id::text)
      AND workflow_ids @> to_jsonb(v_wf9_id::text)
      AND NOT (workflow_ids @> to_jsonb(v_wf_id::text));
  END IF;
END $$;
