-- Workflow: Estimera materialbehov
-- Uses scope_analys, dokument_analys, projekt_faser_urval and arbetskostnad_urval
-- to produce an AI estimate of materials per subfas with precise sokterms.
-- Output saved as material_behov_urval in projekt_context.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Estimera materialbehov',
  'Analyserar projektets scope, dokument och valda faser för att estimera materialbehov per subfas. Genererar precisa söktermer på svenska för matchning mot materialkatalogen. Sparas som underlag för nästa workflow.',
  'forslag',
  '{
    "nodes": [
      {
        "id": "d1",
        "type": "data:projekt",
        "label": "Projektdata",
        "config": {},
        "position": 0
      },
      {
        "id": "c1",
        "type": "data:context",
        "label": "Scope-analys",
        "config": { "nyckel": "scope_analys" },
        "position": 1
      },
      {
        "id": "c2",
        "type": "data:context",
        "label": "Dokumentanalys",
        "config": { "nyckel": "dokument_analys" },
        "position": 2
      },
      {
        "id": "c3",
        "type": "data:context",
        "label": "Fas-urval",
        "config": { "nyckel": "projekt_faser_urval" },
        "position": 3
      },
      {
        "id": "c4",
        "type": "data:context",
        "label": "Arbetsestimat",
        "config": { "nyckel": "arbetskostnad_urval" },
        "position": 4
      },
      {
        "id": "g1",
        "type": "ai:generate",
        "label": "Materialestimering",
        "config": {
          "prompt_template": "PROJEKT: {{namn}}\nKUND: {{kunder.namn}}\n\nSCOPE-ANALYS:\n{{scope_analys}}\n\nDOKUMENTANALYS (mått och specifikationer):\n{{dokument_analys}}\n\nVALDA FASER OCH SUBFASER:\n{{projekt_faser_urval}}\n\nARBETSESTIMAT (referens):\n{{arbetskostnad_urval}}\n\nEstimera materialbehovet för varje subfas i projektet. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):\n{\n  \"material\": [\n    {\n      \"fas\": \"exakt fasnamn från fas-urvalet\",\n      \"subfas\": \"exakt subfasnamn från fas-urvalet\",\n      \"beskrivning\": \"detaljerad produktbeskrivning på svenska\",\n      \"enhet\": \"m2/st/m/kg/liter/förp\",\n      \"antal\": 18.5,\n      \"sokterm\": \"precis sökterm för materialkatalog på svenska (t.ex. OSB-skiva 12mm)\",\n      \"motivering\": \"explicit beräkning: t.ex. 4m × 2.5m = 10m² + 15% spill = 11.5m²\"\n    }\n  ],\n  \"total_material_poster\": 0,\n  \"kommentar\": \"övergripande kommentar om estimatets precision och antaganden\"\n}\n\nVIKTIGT:\n- Basera antal på konkreta mått från dokumentanalysen — inga gissningar\n- Använd svensk byggbranschterminologi i sokterm (det söks mot en svensk katalog)\n- sokterm ska vara specifik: produkttyp + dimension om känt (t.ex. \"Gipsskiva 13mm\" inte \"gips\")\n- Om ett material behövs i flera subfaser, skapa en rad per subfas\n- Inkludera svinn/spill enligt svensk branschstandard (5-20% beroende på material)\n- Ange rätt enhet: m² för skivor/golv/tak, m för lister/rör, st för punktartiklar, kg/liter för bulk"
        },
        "position": 5
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara materialestimat",
        "config": { "nyckel": "material_behov_urval" },
        "position": 6
      }
    ],
    "edges": [
      {"from": "d1", "to": "c1"},
      {"from": "c1", "to": "c2"},
      {"from": "c2", "to": "c3"},
      {"from": "c3", "to": "c4"},
      {"from": "c4", "to": "g1"},
      {"from": "g1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  60
);
