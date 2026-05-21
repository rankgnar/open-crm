-- Workflow: Estimera arbetskostnad
-- Uses scope_analys, dokument_analys, projekt_faser_urval and available
-- yrkesroller to produce an AI estimate of labor per subfase.
-- Output saved as arbetskostnad_urval in projekt_context.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Estimera arbetskostnad',
  'Analyserar projektets scope och valda faser, och estimerar med AI vilka yrkesroller och hur många timmar som behövs per subfas. Sparas som underlag för nästa workflow som skapar de faktiska kostnadsraderna.',
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
        "id": "y1",
        "type": "data:yrkesroller",
        "label": "Yrkesroller",
        "config": {},
        "position": 4
      },
      {
        "id": "g1",
        "type": "ai:generate",
        "label": "Arbetsestimering",
        "config": {
          "prompt_template": "PROJEKT: {{namn}}\nKUND: {{kunder.namn}}\n\nSCOPE-ANALYS:\n{{scope_analys}}\n\nDOKUMENTANALYS:\n{{dokument_analys}}\n\nVALDA FASER OCH SUBFASER:\n{{projekt_faser_urval}}\n\nTILLGÄNGLIGA YRKESROLLER:\n{{yrkesroller_text}}\n\nEstimera arbetskostnaden för varje subfas i projektet. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):\n{\n  \"estimat\": [\n    {\n      \"fas\": \"exakt fasnamn från fas-urvalet\",\n      \"subfas\": \"exakt subfasnamn från fas-urvalet\",\n      \"yrkesroll\": \"exakt namn från yrkesrollslistan ovan\",\n      \"antal_timmar\": 8,\n      \"beskrivning\": \"vad arbetet innebär\",\n      \"motivering\": \"varför dessa timmar\"\n    }\n  ],\n  \"total_timmar\": 0,\n  \"osakerhet\": \"lag/medel/hog\",\n  \"kommentar\": \"övergripande kommentar om estimatet\"\n}\n\nVIKTIGT:\n- Använd ENBART yrkesroller exakt som de stavas i listan ovan\n- Om en subfas kräver flera yrkesroller, skapa en rad per yrkesroll\n- Estimera realistiskt för ett professionellt byggföretag i Sverige\n- Basera timantalet på informationen från scope-analysen och dokumentanalysen"
        },
        "position": 5
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara arbetsestimat",
        "config": { "nyckel": "arbetskostnad_urval" },
        "position": 6
      }
    ],
    "edges": [
      {"from": "d1", "to": "c1"},
      {"from": "c1", "to": "c2"},
      {"from": "c2", "to": "c3"},
      {"from": "c3", "to": "y1"},
      {"from": "y1", "to": "g1"},
      {"from": "g1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  50
);
