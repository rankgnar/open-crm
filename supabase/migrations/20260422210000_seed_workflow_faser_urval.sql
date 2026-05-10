-- Workflow: Identifiera projekttyp och faser
-- Reads scope_analys + dokument_analys from context, loads all fas-mallar,
-- and uses AI to match the project against available phases/subphases.
-- Saves the result as projekt_faser_urval in projekt_context.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Identifiera projekttyp och faser',
  'Analyserar projektets scope och dokument, jämför mot tillgängliga fas-mallar och väljer ut relevanta faser och subfaser. Flaggar faser som saknas i systemet.',
  'analys',
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
        "id": "f1",
        "type": "data:fas-mallar",
        "label": "Fas-mallar",
        "config": {},
        "position": 3
      },
      {
        "id": "g1",
        "type": "ai:generate",
        "label": "Fas-urval",
        "config": {
          "prompt_template": "PROJEKT: {{namn}}\nKUND: {{kunder.namn}}\n\nSCOPE-ANALYS:\n{{scope_analys}}\n\nDOKUMENTANALYS:\n{{dokument_analys}}\n\nTILLGÄNGLIGA FAS-MALLAR:\n{{fas_text}}\n\nBaserat på ovanstående, analysera projektet och returnera ENBART ett JSON-objekt (ingen text utanför JSON) med följande struktur:\n{\n  \"projekt_typ\": \"kort beskrivning av projekttypen, t.ex. Köksrenovering, Badrumsrenovering, Nybyggnation\",\n  \"vald_mall\": \"namn på den fas-mall som passar bäst, eller null om ingen passar\",\n  \"valda_faser\": [\"fasnamn1\", \"fasnamn2\"],\n  \"valda_subfaser\": [\n    { \"fas\": \"fasnamn\", \"subfaser\": [\"subfasnamn1\", \"subfasnamn2\"] }\n  ],\n  \"saknade_faser\": [\"beskrivning av fas som behövs men saknas i systemet\"],\n  \"saknar_mall\": true/false,\n  \"motivering\": \"kort förklaring av varför dessa faser valdes och vad som eventuellt saknas\"\n}"
        },
        "position": 4
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara fas-urval",
        "config": { "nyckel": "projekt_faser_urval" },
        "position": 5
      }
    ],
    "edges": [
      {"from": "d1", "to": "c1"},
      {"from": "c1", "to": "c2"},
      {"from": "c2", "to": "f1"},
      {"from": "f1", "to": "g1"},
      {"from": "g1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  30
);
