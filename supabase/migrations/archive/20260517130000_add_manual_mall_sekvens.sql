-- Add trigger_inputs column so triggers can declare extra picker inputs
ALTER TABLE workflow_triggers ADD COLUMN IF NOT EXISTS trigger_inputs jsonb DEFAULT '[]';

-- Insert workflow, sekvens and trigger for manual mall selection
DO $$
DECLARE
  wf_manual uuid;
  wf1 uuid; wf2 uuid; wf3b uuid; wf4 uuid;
  wf5 uuid; wf6 uuid; wf7 uuid; wf8 uuid;
  wf8b uuid; wf9 uuid; wf10 uuid;
  seq_id uuid;
BEGIN
  INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
  VALUES (
    '3-Välj mall manuellt',
    'Laddar vald fas-mall direkt — alla faser och subfaser inkluderas utan AI-urval.',
    'forslag',
    '{
      "nodes": [
        { "id": "d1", "type": "data:projekt",           "label": "Projektdata",    "config": {},                                                                   "position": 0 },
        { "id": "a1", "type": "action:use-mall-direct", "label": "Ladda mall",     "config": {},                                                                   "position": 1 },
        { "id": "s1", "type": "action:save-context",    "label": "Spara fas-urval","config": { "nyckel": "projekt_faser_urval", "source_key": "projekt_faser_urval" }, "position": 2 }
      ],
      "edges": [
        { "from": "d1", "to": "a1" },
        { "from": "a1", "to": "s1" }
      ]
    }',
    true,
    100
  )
  RETURNING id INTO wf_manual;

  SELECT id INTO wf1  FROM workflows WHERE namn = '1-Analysera projektets scope'    LIMIT 1;
  SELECT id INTO wf2  FROM workflows WHERE namn = '2-Analysera projektdokument'     LIMIT 1;
  SELECT id INTO wf3b FROM workflows WHERE namn = '3b-Beräkna mått och mängder'    LIMIT 1;
  SELECT id INTO wf4  FROM workflows WHERE namn = '4-Skapa förslag med faser'       LIMIT 1;
  SELECT id INTO wf5  FROM workflows WHERE namn = '5-Estimera arbetskostnad'        LIMIT 1;
  SELECT id INTO wf6  FROM workflows WHERE namn = '6-Estimera materialbehov'        LIMIT 1;
  SELECT id INTO wf7  FROM workflows WHERE namn = '7-Matcha material mot katalog'   LIMIT 1;
  SELECT id INTO wf8  FROM workflows WHERE namn = '8-Sök materialpris på webben'   LIMIT 1;
  SELECT id INTO wf8b FROM workflows WHERE namn = '8b-Granska förslag'             LIMIT 1;
  SELECT id INTO wf9  FROM workflows WHERE namn = '9-Fyll i förslag med kostnader'  LIMIT 1;
  SELECT id INTO wf10 FROM workflows WHERE namn = '10-Generera tidplan från förslag' LIMIT 1;

  INSERT INTO workflow_sequences (namn, beskrivning, workflow_ids, aktiv)
  VALUES (
    'sekvens-förslag-manual',
    'Generera förslag med manuellt vald mall — AI estimerar arbetkostnad och material',
    jsonb_build_array(wf1, wf2, wf_manual, wf3b, wf4, wf5, wf6, wf7, wf8, wf8b, wf9, wf10),
    true
  )
  RETURNING id INTO seq_id;

  INSERT INTO workflow_triggers (sequence_id, seccion, etikett, icon, sortering, trigger_inputs)
  VALUES (seq_id, 'projekt', 'Generera förslag — välj mall', 'ListOrdered', 15, '["fas_mall_id"]'::jsonb);
END;
$$;
