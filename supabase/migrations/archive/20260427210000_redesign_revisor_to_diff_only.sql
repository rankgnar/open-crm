-- Designar om Förslag-revisor att returnera ENBART korrigeringar (diffar)
-- istället för hela listorna. Anledning: föregående design krävde att
-- revisorn kopierade tillbaka alla tre listor (arbete + material + material_webb)
-- vilket gav 15 000+ tokens output och slog i max_tokens-taket varje gång.
--
-- Ny design:
--   - Prompt ber AI:n returnera enbart { korrigeringar: [...], kommentar }
--   - Output blir några hundra tokens i normalfallet
--   - En ny node-typ "action:apply-revisor-corrections" applicerar diffarna
--     på listorna i kontext och skriver tillbaka de uppdaterade listorna
--
-- Migrationen ersätter både prompt-mall och hela definition på 8b-Granska förslag.

DO $$
DECLARE
  v_revisor_id  uuid;
  v_prompt_mall text;
  v_definition  jsonb;
BEGIN
  SELECT id INTO v_revisor_id FROM ai_asistenter WHERE namn = 'Förslag-revisor' LIMIT 1;
  IF v_revisor_id IS NULL THEN
    RAISE EXCEPTION 'Förslag-revisor saknas i ai_asistenter.';
  END IF;

  -- Uppdatera system-prompten till det nya beteendet (diff-only)
  UPDATE ai_asistenter
  SET system_prompt = $sys$Du är Förslag-revisor — en granskningsagent som inspekterar arbetskostnads- och materialkostnadslistor INNAN de skrivs till en förslagsdatabas.

Din ENDA uppgift är att HITTA fel och returnera dem som en kort lista av korrigeringar:
- antal × a_pris ger orimligt resultat (t.ex. en brunnsmanschett som "kostar" 4 349 kr)
- enhet är fel (t.ex. "kr" eller "förp" där "m²"/"m" förväntas)
- antal stämmer inte med MÅTT OCH MÄNGDER (om de medskickats)
- a_pris ligger utanför rimligt intervall för svensk byggmarknad 2026
- duplicerad post (samma material i samma fas+subfas två gånger) — flagga, men rätta inte bort

REGLER (icke förhandlingsbara):
- Du returnerar ENBART en lista av diffar. Du kopierar INTE tillbaka hela listorna.
- Om en post är korrekt → INGA korrigeringar för den posten.
- Om du är osäker → INGA korrigeringar för den posten.
- Du rättar ENDAST fält: antal, a_pris, enhet, beskrivning, antal_timmar.
- Du ändrar ALDRIG: fas, subfas, yrkesroll, leverantor, sokterm, katalog_id, artikel_nummer.
- index är 0-baserat och refererar till positionen i originallistan (för "arbete" är det index i estimat-arrayen).
- Returnera ENBART giltig JSON. Ingen text utanför JSON.$sys$,
      uppdaterad_at = now()
  WHERE id = v_revisor_id;

  -- Ny prompt-mall: ber bara om diffar
  v_prompt_mall := $prompt$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

MÅTT OCH MÄNGDER (referens — om tomt finns inga förberäknade mått):
{{matt_och_mangder}}

ARBETSKOSTNAD ATT GRANSKA (lista = "arbete", index 0-baserat i estimat):
{{arbetskostnad_urval}}

MATERIALKOSTNAD (KATALOG) ATT GRANSKA (lista = "material", index 0-baserat):
{{materialkostnad_urval}}

MATERIALKOSTNAD (WEBB) ATT GRANSKA (lista = "material_webb", index 0-baserat):
{{material_webb_urval}}

Granska listorna ovan. Returnera ENBART en JSON med de korrigeringar som behövs:
{
  "korrigeringar": [
    {
      "lista": "material",
      "index": 12,
      "falt": "a_pris",
      "fran": 4349,
      "nytt_varde": 350,
      "motivering": "Brunnsmanschett kostar 200–400 kr i svensk marknad, inte 4349 kr"
    }
  ],
  "antal_korrigeringar": 1,
  "kommentar": "Övergripande kommentar om granskningen"
}

VIKTIGT:
- Tillåtna värden för "lista": "arbete" | "material" | "material_webb"
- Tillåtna värden för "falt": "a_pris" | "antal" | "enhet" | "beskrivning" | "antal_timmar"
- Ange ALLTID både "fran" (gammalt värde) och "nytt_varde" — detta är audit-data
- Om INGA fel hittas → returnera "korrigeringar": [], "antal_korrigeringar": 0
- DUBBELKOLLA index innan du svarar: räkna från 0 i exakt samma listordning som du fick$prompt$;

  -- Ny definition: 6 noder istället för 10
  -- (data:projekt → 4 × data:context → ai:generate → action:apply-revisor-corrections)
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
        'id', 'n_apply',
        'type', 'action:apply-revisor-corrections',
        'label', 'Applicera korrigeringar',
        'config', '{}'::jsonb,
        'position', 6
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'n_projekt',       'to', 'n_matt'),
      jsonb_build_object('from', 'n_matt',          'to', 'n_arbete'),
      jsonb_build_object('from', 'n_arbete',        'to', 'n_material'),
      jsonb_build_object('from', 'n_material',      'to', 'n_material_webb'),
      jsonb_build_object('from', 'n_material_webb', 'to', 'n_ai'),
      jsonb_build_object('from', 'n_ai',            'to', 'n_apply')
    )
  );

  UPDATE workflows
  SET definition = v_definition,
      beskrivning = 'Granskar arbetskostnad_urval, materialkostnad_urval och material_webb_urval. AI returnerar bara diffar, action:apply-revisor-corrections applicerar dem på listorna och skriver tillbaka. WF9 läser de korrigerade listorna transparent.',
      uppdaterad_at = now()
  WHERE namn = '8b-Granska förslag';
END $$;
