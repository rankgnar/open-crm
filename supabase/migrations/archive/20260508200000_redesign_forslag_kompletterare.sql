-- Redesign: Granska och komplettera förslag
-- Replaces the old generic-AI workflow with the same WF6→WF7 pipeline
-- (Materialbehovsestimator → action:match-material-katalog) but in additive
-- mode: targets a specific forslag_id, never deletes existing rows.
--
-- New 10-node pipeline:
--   data:projekt → data:context(scope) → data:context(dok) → data:context(matt)
--   → data:forslag-faser-for-ai (reads förslag → projekt_faser_urval + arbetskostnad_urval)
--   → ai:generate (Materialbehovsestimator)
--   → action:save-context(material_behov_urval)
--   → data:context(material_behov_urval)
--   → action:match-material-katalog
--   → action:fill-missing-forslag-kostnader

DO $$
DECLARE
  v_workflow    uuid;
  v_estimator   uuid;
  v_prompt      text;
BEGIN
  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Granska och komplettera förslag';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Granska och komplettera förslag" hittades inte.';
  END IF;

  SELECT id INTO v_estimator FROM ai_asistenter WHERE namn = 'Materialbehovsestimator';
  IF v_estimator IS NULL THEN
    RAISE EXCEPTION 'Assistent "Materialbehovsestimator" hittades inte.';
  END IF;

  -- Same prompt as WF6 — Materialbehovsestimator already knows how to handle
  -- projekt_faser_urval and arbetskostnad_urval produced by data:forslag-faser-for-ai.
  v_prompt := $TMPL$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS (mått och specifikationer):
{{dokument_analys}}

VALDA FASER OCH SUBFASER (från befintligt förslag):
{{projekt_faser_urval}}

MÅTT OCH MÄNGDER (förberäknade — alla ytor, längder, antal och åtgång är redan uträknade):
{{matt_och_mangder}}

ARBETATIMMAR I FÖRSLAGET (referens — visar vad som ska utföras per subfas):
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
  med rimlig uppskattning och flagga med "uppskattat" i motiveringen.$TMPL$;

  UPDATE workflows
  SET definition = jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n_projekt',   'type','data:projekt',                    'label','Projektdata',                   'config','{}' ::jsonb,                                                                              'position',0),
      jsonb_build_object('id','n_scope',     'type','data:context',                    'label','Scope-analys',                  'config','{"nyckel":"scope_analys","optional":true}'::jsonb,                                        'position',1),
      jsonb_build_object('id','n_dok',       'type','data:context',                    'label','Dokumentanalys',                'config','{"nyckel":"dokument_analys","optional":true}'::jsonb,                                     'position',2),
      jsonb_build_object('id','n_matt',      'type','data:context',                    'label','Mått och mängder',              'config','{"nyckel":"matt_och_mangder","optional":true}'::jsonb,                                    'position',3),
      jsonb_build_object('id','n_faser',     'type','data:forslag-faser-for-ai',       'label','Förslag faser för AI',          'config','{}' ::jsonb,                                                                              'position',4),
      jsonb_build_object('id','n_ai',        'type','ai:generate',                     'label','Estimera material',             'config', jsonb_build_object('assistent_id',v_estimator::text,'prompt_template',v_prompt),          'position',5),
      jsonb_build_object('id','n_save',      'type','action:save-context',             'label','Spara materialestimat',         'config','{"nyckel":"material_behov_urval"}'::jsonb,                                               'position',6),
      jsonb_build_object('id','n_reload',    'type','data:context',                    'label','Ladda materialestimat',         'config','{"nyckel":"material_behov_urval"}'::jsonb,                                               'position',7),
      jsonb_build_object('id','n_match',     'type','action:match-material-katalog',   'label','Matcha mot katalog',            'config','{}' ::jsonb,                                                                              'position',8),
      jsonb_build_object('id','n_fill',      'type','action:fill-missing-forslag-kostnader','label','Fyll tomma subfaser',      'config','{}' ::jsonb,                                                                              'position',9)
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from','n_projekt','to','n_scope'),
      jsonb_build_object('from','n_scope',  'to','n_dok'),
      jsonb_build_object('from','n_dok',    'to','n_matt'),
      jsonb_build_object('from','n_matt',   'to','n_faser'),
      jsonb_build_object('from','n_faser',  'to','n_ai'),
      jsonb_build_object('from','n_ai',     'to','n_save'),
      jsonb_build_object('from','n_save',   'to','n_reload'),
      jsonb_build_object('from','n_reload', 'to','n_match'),
      jsonb_build_object('from','n_match',  'to','n_fill')
    )
  )
  WHERE id = v_workflow;

END $$;
