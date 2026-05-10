-- Workflow: Generera tidplan från förslag
-- Reads faser + arbetstimmar from the latest utkast förslag,
-- uses AI to estimate duration per fas, then creates kalender_events
-- (hel_dag) for each fas sequentially and updates forslag_faser dates.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Generera tidplan från förslag',
  'Läser faser och arbetstimmar från det senaste utkastförslaget, låter AI estimera hur många dagar varje fas tar och skapar sedan kalenderhändelser automatiskt per fas.',
  'tidplan',
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
        "id": "d2",
        "type": "data:forslag-faser",
        "label": "Förslag — faser och timmar",
        "config": {},
        "position": 1
      },
      {
        "id": "g1",
        "type": "ai:generate",
        "label": "AI — Estimera tidplan",
        "config": {
          "assistent_id": "",
          "prompt_template": "PROJEKT: {{namn}}\nKUND: {{kunder.namn}}\nFÖRSLAG: {{forslag_titel}}\n\nFASER OCH ARBETSTIMMAR:\n{{forslag_faser_text}}\n\nTotalt: {{total_timmar}} arbetstimmar\nArbetstakt: {{timmar_per_dag}} timmar per arbetsdag\n\nDu är en erfaren projektplanerare inom bygg och renovering i Sverige.\nEstimera hur många arbetsdagar varje fas tar baserat på arbetstimmarna ovan.\nBeräkning: duration_dagar = ceil(fas_timmar / timmar_per_dag), minimum 1 dag per fas.\n\nReturnera ENBART ett JSON-objekt utan text utanför:\n{\n  \"faser\": [\n    { \"fas\": \"exakt fasnamn som ovan\", \"duration_dagar\": 5 },\n    { \"fas\": \"nästa fas\", \"duration_dagar\": 3 }\n  ]\n}\n\nVIKTIGT:\n- Kopiera fasnamnen EXAKT som de skrivs ovan\n- Faserna körs sekventiellt, ingen parallellitet\n- Ingen text utanför JSON-objektet"
        },
        "position": 2
      },
      {
        "id": "a1",
        "type": "action:create-tidplan",
        "label": "Skapa tidplan i kalender",
        "config": {
          "startdatum": "",
          "rensa_befintliga": true
        },
        "position": 3
      }
    ],
    "edges": [
      {"from": "d1", "to": "d2"},
      {"from": "d2", "to": "g1"},
      {"from": "g1", "to": "a1"}
    ]
  }'::jsonb,
  true,
  100
);
