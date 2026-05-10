-- Workflow: Fyll i förslag med kostnader
-- Reads materialkostnad_urval + material_webb_urval + arbetskostnad_urval from context.
-- Inserts material and labor cost rows into the latest utkast förslag for the project.
-- Clears existing rows before inserting to allow re-running.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Fyll i förslag med kostnader',
  'Skapar material- och arbetskostnadsrader i det senaste utkastförslaget baserat på estimaten från tidigare workflows. Rensar befintliga rader och fyller i på nytt vid varje körning.',
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
        "label": "Materialkostnad",
        "config": { "nyckel": "materialkostnad_urval" },
        "position": 1
      },
      {
        "id": "c2",
        "type": "data:context",
        "label": "Webbpriser",
        "config": { "nyckel": "material_webb_urval", "optional": true },
        "position": 2
      },
      {
        "id": "c3",
        "type": "data:context",
        "label": "Arbetskostnad",
        "config": { "nyckel": "arbetskostnad_urval" },
        "position": 3
      },
      {
        "id": "a1",
        "type": "action:fill-forslag-kostnader",
        "label": "Fyll i förslag",
        "config": {},
        "position": 4
      }
    ],
    "edges": [
      {"from": "d1", "to": "c1"},
      {"from": "c1", "to": "c2"},
      {"from": "c2", "to": "c3"},
      {"from": "c3", "to": "a1"}
    ]
  }'::jsonb,
  true,
  90
);
