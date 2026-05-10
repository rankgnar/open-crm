-- Workflow: Analysera projektdokument
-- Fetches all project files (images + PDFs), runs AI vision/document analysis,
-- synthesizes a detailed project description and saves to projekt_context.

INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
VALUES (
  'Analysera projektdokument',
  'Hämtar alla filer från projektet, analyserar bilder med AI-vision och PDF-dokument, och skapar ett detaljerat underlag som sparas i projektets kontext.',
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
        "id": "d2",
        "type": "data:projekt:dokument",
        "label": "Projektfiler",
        "config": {},
        "position": 1
      },
      {
        "id": "a1",
        "type": "ai:analyze-bilder",
        "label": "Bildanalys",
        "config": {
          "prompt": "Analysera dessa byggprojektbilder noggrant. Beskriv:\n1. Vad visas (rum, utrymme, fasad, tak, etc.)\n2. Synliga mått och dimensioner\n3. Befintliga installationer (el, VVS, ventilation)\n4. Material och ytskikt\n5. Skick och eventuella skador\n6. Allt som är relevant för att förstå projektets omfattning"
        },
        "position": 2
      },
      {
        "id": "a2",
        "type": "ai:analyze-pdf",
        "label": "Dokumentanalys",
        "config": {
          "prompt": "Analysera detta dokument och extrahera all relevant information för ett bygge- eller renoveringsprojekt:\n1. Mått och dimensioner\n2. Tekniska specifikationer och krav\n3. Material- och produktbeskrivningar\n4. Ritningsinformation\n5. Myndighetskrav eller standarder som nämns"
        },
        "position": 3
      },
      {
        "id": "g1",
        "type": "ai:generate",
        "label": "Sammanfattning",
        "config": {
          "prompt_template": "PROJEKT: {{namn}}\nKUND: {{kunder.namn}}\nBESKRIVNING: {{beskrivning}}\n\nBILDANALYS ({{antal_bilder}} bilder):\n{{bild_analys}}\n\nDOKUMENTANALYS ({{antal_pdf}} PDF-dokument):\n{{pdf_analys}}\n\nBaserat på ovanstående, skriv en sammanhängande och detaljerad projektbeskrivning som förklarar:\n1. Vad projektet handlar om och vad som ska göras\n2. Befintliga förhållanden och skick\n3. Viktiga mått, ytor och dimensioner\n4. Material, installationer och tekniska aspekter\n5. Potentiella utmaningar eller saker att beakta i offerten\n\nVar specifik och använd informationen från bilderna och dokumenten."
        },
        "position": 4
      },
      {
        "id": "s1",
        "type": "action:save-context",
        "label": "Spara dokumentanalys",
        "config": {
          "nyckel": "dokument_analys"
        },
        "position": 5
      }
    ],
    "edges": [
      {"from": "d1", "to": "d2"},
      {"from": "d2", "to": "a1"},
      {"from": "a1", "to": "a2"},
      {"from": "a2", "to": "g1"},
      {"from": "g1", "to": "s1"}
    ]
  }'::jsonb,
  true,
  20
);
