-- Workflow: Skapa förslag med faser
-- Reads projekt_faser_urval from context, creates a Förslag with
-- only the selected phases/subphases that exist in fas-mallar.
-- Stops with a clear message if the mall or any fase is missing.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Skapa förslag med faser',
  'Skapar ett nytt förslag kopplat till projektet och lägger till de faser och subfaser som identifierats av workflow 3. Inga priser — enbart strukturen.',
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
        "label": "Fas-urval",
        "config": { "nyckel": "projekt_faser_urval" },
        "position": 2
      },
      {
        "id": "a1",
        "type": "action:create-forslag",
        "label": "Skapa förslag",
        "config": { "giltig_dagar": 30, "moms_procent": 25 },
        "position": 3
      },
      {
        "id": "a2",
        "type": "action:add-faser-to-forslag",
        "label": "Lägg till faser",
        "config": {},
        "position": 4
      }
    ],
    "edges": [
      {"from": "d1", "to": "c1"},
      {"from": "c1", "to": "c2"},
      {"from": "c2", "to": "a1"},
      {"from": "a1", "to": "a2"}
    ]
  }'::jsonb,
  true,
  40
);
