-- Skapar nytt workflow "3b-Beräkna mått och mängder" som ligger mellan WF3 och WF4.
-- Workflow:t läser scope_analys + dokument_analys + projekt_faser_urval och låter
-- Måttkalkylator-assistenten räkna ut alla ytor, längder, antal och materialåtgång.
-- Resultatet sparas som projekt_context-nyckel "matt_och_mangder" och konsumeras
-- av WF5 (arbete) och WF6 (material) — som därefter inte längre räknar om.
--
-- Migrationen gör tre saker:
--   1. INSERT av nya workflow:et med alla noder och edges.
--   2. UPDATE av WF5 prompt_template — lägger till MÅTT-sektion.
--   3. UPDATE av WF6 prompt_template — lägger till MÅTT-sektion + tar bort
--      redundant beräkningsinstruktion (eftersom siffror redan är förberäknade).

DO $$
DECLARE
  v_mattkalk_id  uuid;
  v_prompt_mall  text;
  v_definition   jsonb;
BEGIN
  SELECT id INTO v_mattkalk_id FROM ai_asistenter WHERE namn = 'Måttkalkylator';
  IF v_mattkalk_id IS NULL THEN
    RAISE EXCEPTION 'Måttkalkylator-assistenten saknas. Skapa den i ai_asistenter innan migrationen körs.';
  END IF;

  -- ── 1. Bygg prompt-mall för det nya workflow:et ─────────────────────────
  v_prompt_mall := $prompt$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS:
{{dokument_analys}}

VALDA FASER OCH SUBFASER:
{{projekt_faser_urval}}

Räkna ut ALLA mått, antal och materialåtgång som behövs för att senare estimera arbetskostnad och material.

Inkludera minst:
- Alla ytor (golv, vägg, tak per rum eller område)
- Alla längder (omkrets, kabel, rör, lister, sockel)
- Alla antal diskreta enheter (uttag, brytare, spotlights, brunnar, genomföringar)
- Antal plattor för all kakel/klinker baserat på dimensioner och spill
- Materialåtgång för fix, fog, primer, tätskikt, flytspackel etc. enligt branschstandard

Visa beräkningen steg för steg i `berakning`-fältet på varje rad. Använd ENDAST tal och formler från scope och dokumentanalys — gissa inte mått som inte finns.

Om något kritiskt mått saknas, lista det i `saknade_matt` istället för att hitta på.$prompt$;

  -- ── 2. Bygg definition-JSON med 6 noder ─────────────────────────────────
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
        'id', 'n_scope',
        'type', 'data:context',
        'label', 'Hämta scope-analys',
        'config', jsonb_build_object('nyckel', 'scope_analys'),
        'position', 1
      ),
      jsonb_build_object(
        'id', 'n_dokument',
        'type', 'data:context',
        'label', 'Hämta dokumentanalys',
        'config', jsonb_build_object('nyckel', 'dokument_analys', 'optional', true),
        'position', 2
      ),
      jsonb_build_object(
        'id', 'n_faser',
        'type', 'data:context',
        'label', 'Hämta fas-urval',
        'config', jsonb_build_object('nyckel', 'projekt_faser_urval'),
        'position', 3
      ),
      jsonb_build_object(
        'id', 'n_ai',
        'type', 'ai:generate',
        'label', 'Beräkna mått och mängder',
        'config', jsonb_build_object(
          'assistent_id', v_mattkalk_id::text,
          'prompt_template', v_prompt_mall
        ),
        'position', 4
      ),
      jsonb_build_object(
        'id', 'n_save',
        'type', 'action:save-context',
        'label', 'Spara mått och mängder',
        'config', jsonb_build_object('nyckel', 'matt_och_mangder', 'source_key', 'ai_output'),
        'position', 5
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'n_projekt', 'to', 'n_scope'),
      jsonb_build_object('from', 'n_scope',   'to', 'n_dokument'),
      jsonb_build_object('from', 'n_dokument','to', 'n_faser'),
      jsonb_build_object('from', 'n_faser',   'to', 'n_ai'),
      jsonb_build_object('from', 'n_ai',      'to', 'n_save')
    )
  );

  -- ── 3. INSERT workflow:et (eller UPDATE om det redan finns med samma namn) ─
  IF EXISTS (SELECT 1 FROM workflows WHERE namn = '3b-Beräkna mått och mängder') THEN
    UPDATE workflows
    SET definition = v_definition,
        beskrivning = 'Räknar ut ytor, längder, antal och materialåtgång ur scope och faser. Resultatet sparas som projekt_context-nyckel "matt_och_mangder" och konsumeras av WF5 och WF6.',
        uppdaterad_at = now()
    WHERE namn = '3b-Beräkna mått och mängder';
  ELSE
    INSERT INTO workflows (namn, beskrivning, kategori, definition, version, aktiv, sortering)
    VALUES (
      '3b-Beräkna mått och mängder',
      'Räknar ut ytor, längder, antal och materialåtgång ur scope och faser. Resultatet sparas som projekt_context-nyckel "matt_och_mangder" och konsumeras av WF5 och WF6.',
      'analys',
      v_definition,
      1,
      true,
      35
    );
  END IF;
END $$;

-- ── 4. UPDATE WF5 prompt — lägg till MÅTT-sektion ─────────────────────────
UPDATE workflows
SET definition = jsonb_set(
  definition, '{nodes}',
  (SELECT jsonb_agg(
    CASE WHEN node->>'type' = 'ai:generate'
         THEN jsonb_set(
           node, '{config,prompt_template}',
           to_jsonb($wf5$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS:
{{dokument_analys}}

VALDA FASER OCH SUBFASER:
{{projekt_faser_urval}}

MÅTT OCH MÄNGDER (förberäknade — använd dessa siffror direkt, räkna inte om):
{{matt_och_mangder}}

TILLGÄNGLIGA YRKESROLLER:
{{yrkesroller_text}}

Estimera arbetskostnaden för varje subfas i projektet. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "estimat": [
    {
      "fas": "exakt fasnamn från fas-urvalet",
      "subfas": "exakt subfasnamn från fas-urvalet",
      "yrkesroll": "exakt namn från yrkesrollslistan ovan",
      "antal_timmar": 8,
      "beskrivning": "vad arbetet innebär",
      "motivering": "varför dessa timmar"
    }
  ],
  "total_timmar": 0,
  "osakerhet": "lag/medel/hog",
  "kommentar": "övergripande kommentar om estimatet"
}

VIKTIGT:
- Använd ENBART yrkesroller exakt som de stavas i listan ovan
- Om en subfas kräver flera yrkesroller, skapa en rad per yrkesroll
- Använd MÅTT OCH MÄNGDER ovan som grund för åtgång — räkna inte om m², m, antal
- Estimera realistiskt för ett professionellt byggföretag i Sverige$wf5$::text)
         )
         ELSE node END
  ) FROM jsonb_array_elements(definition->'nodes') AS node)
)
WHERE namn = '5-Estimera arbetskostnad';

-- ── 5. UPDATE WF6 prompt — lägg till MÅTT-sektion + ta bort krav att räkna ─
UPDATE workflows
SET definition = jsonb_set(
  definition, '{nodes}',
  (SELECT jsonb_agg(
    CASE WHEN node->>'type' = 'ai:generate'
         THEN jsonb_set(
           node, '{config,prompt_template}',
           to_jsonb($wf6$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS (mått och specifikationer):
{{dokument_analys}}

VALDA FASER OCH SUBFASER:
{{projekt_faser_urval}}

MÅTT OCH MÄNGDER (förberäknade — alla ytor, längder, antal och åtgång är redan uträknade):
{{matt_och_mangder}}

ARBETSETIMAT (referens):
{{arbetskostnad_urval}}

Skapa en konkret materialinköpslista för varje subfas. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "material": [
    {
      "fas": "exakt fasnamn från fas-urvalet",
      "subfas": "exakt subfasnamn från fas-urvalet",
      "beskrivning": "detaljerad produktbeskrivning på svenska",
      "enhet": "m²/m/st/kg/liter/säck/burk/pat/rulle/set/pkt",
      "antal": 18.5,
      "sokterm": "precis sökterm för materialkatalog (t.ex. OSB-skiva 12mm)",
      "motivering": "kort motivering — siffror tas direkt från MÅTT OCH MÄNGDER"
    }
  ],
  "total_material_poster": 0,
  "kommentar": "övergripande kommentar om antaganden"
}

VIKTIGT:
- ANTAL och ENHET för varje material kommer DIREKT från MÅTT OCH MÄNGDER ovan.
  Du räknar INTE om m², m, antal eller åtgång — använd precalculerade värden.
- Din uppgift är att VÄLJA produkt och beskrivning, inte att räkna.
- Sokterm: produkttyp + dimension (t.ex. "Gipsskiva 13mm", "PEX rör-i-rör 15mm").
- Skapa en rad per subfas där materialet behövs.
- Om något material inte finns precalculerat i MÅTT OCH MÄNGDER, lägg till det
  med rimlig uppskattning och flagga med "uppskattat" i motiveringen.$wf6$::text)
         )
         ELSE node END
  ) FROM jsonb_array_elements(definition->'nodes') AS node)
)
WHERE namn = '6-Estimera materialbehov';
