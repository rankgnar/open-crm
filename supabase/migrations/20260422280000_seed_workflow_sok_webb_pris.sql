-- Workflow: Sök materialpris på webben
-- Reads material_faltande from context (items not found in catalog).
-- Searches Byggmax and Bauhaus for each item's price.
-- Falls back to AI price estimation when web search returns nothing.
-- Never stops — items without any price get a_pris=0 flagged as 'okänd'.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Sök materialpris på webben',
  'Hämtar priser från Byggmax och Bauhaus för material som saknas i katalogen. Faller tillbaka på AI-estimering om webbsökning misslyckas. Kräver att workflow "Matcha material mot katalog" körts först.',
  'forslag',
  '{
    "nodes": [
      {
        "id": "c1",
        "type": "data:context",
        "label": "Material att söka",
        "config": { "nyckel": "material_faltande" },
        "position": 0
      },
      {
        "id": "a1",
        "type": "action:search-web-price",
        "label": "Sök pris på webben",
        "config": {},
        "position": 1
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara webbpriser",
        "config": { "nyckel": "material_webb_urval", "source_key": "material_webb_urval" },
        "position": 2
      }
    ],
    "edges": [
      {"from": "c1", "to": "a1"},
      {"from": "a1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  80
);
