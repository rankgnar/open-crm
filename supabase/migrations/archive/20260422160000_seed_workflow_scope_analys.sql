INSERT INTO workflows (namn, beskrivning, kategori, sortering, definition)
VALUES (
  'Analysera projektets scope',
  'Hämtar projektbeskrivning och anteckningar, låter AI generera en strukturerad scope-analys av projektet.',
  'analys',
  0,
  '{
    "nodes": [
      {
        "id": "n1",
        "type": "data:projekt",
        "label": "Hämta projektdata",
        "config": {},
        "position": 0
      },
      {
        "id": "n2",
        "type": "data:projekt:anteckningar",
        "label": "Hämta anteckningar",
        "config": {},
        "position": 1
      },
      {
        "id": "n3",
        "type": "ai:generate",
        "label": "Generera scope-analys",
        "config": {
          "assistent_id": "",
          "prompt_template": "Du är en erfaren projektledare i Sverige. Baserat på informationen nedan ska du skapa en välstrukturerad scope-analys av projektet.\n\nPROJEKT: {{namn}}\nBESKRIVNING: {{beskrivning}}\nADRESS: {{arbetsplats_adress}}, {{arbetsplats_stad}}\nBUDGET: {{budget_total}} kr\nROT-AVDRAG: {{rot_avdrag}}\nKUND: {{kunder.namn}}\n\nANTECKNINGAR FRÅN PROJEKTET:\n{{anteckningar_text}}\n\nSkapa en tydlig och professionell analys med följande struktur:\n\n1. SAMMANFATTNING\nBeskriv projektet kort i 2-3 meningar.\n\n2. PROJEKTETS SCOPE\nVad ingår i projektet baserat på beskrivning och anteckningar. Lista de viktigaste delarna.\n\n3. IDENTIFIERADE UTMANINGAR\nRisker, oklarheter eller komplexa moment som kräver uppmärksamhet.\n\n4. REKOMMENDERADE NÄSTA STEG\nKonkreta åtgärder för att komma vidare med projektet.\n\nSvara på svenska. Inga JSON-koder — bara läsbar och professionell text."
        },
        "position": 2
      }
    ],
    "edges": [
      {"from": "n1", "to": "n2"},
      {"from": "n2", "to": "n3"}
    ]
  }'
);
