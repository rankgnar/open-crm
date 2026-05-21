-- Workflow: Matcha material mot katalog
-- Reads material_behov_urval from context, matches each item against
-- material_katalog using exact → starts_with → contains strategy.
-- Always saves material_faltande to context (even if empty).
-- Stops with a clear message listing every unmatched item.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Matcha material mot katalog',
  'Söker varje estimerat material i materialkatalogen och berikar med pris och leverantör. Sparar material_faltande för saknade artiklar och material_kostnad_urval för matchade. Stannar med tydligt felmeddelande om något saknas i katalogen.',
  'forslag',
  '{
    "nodes": [
      {
        "id": "c1",
        "type": "data:context",
        "label": "Materialestimat",
        "config": { "nyckel": "material_behov_urval" },
        "position": 0
      },
      {
        "id": "a1",
        "type": "action:match-material-katalog",
        "label": "Matcha mot katalog",
        "config": {},
        "position": 1
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara materialkostnad",
        "config": { "nyckel": "materialkostnad_urval", "source_key": "materialkostnad_urval" },
        "position": 2
      }
    ],
    "edges": [
      {"from": "c1", "to": "a1"},
      {"from": "a1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  70
);
