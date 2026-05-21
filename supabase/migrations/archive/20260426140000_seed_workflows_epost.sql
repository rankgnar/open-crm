-- Workflows: e-post automatiseringar
-- Tre workflows som använder de nya noderna action:send-epost / action:queue-epost.
-- Mall-id slås upp dynamiskt via namn så seeden funkar oavsett UUID:n.

-- 1. Skicka Offert till kund
INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
SELECT
  'Skicka Offert till kund',
  'Skickar offert-mejl med mallen "Offert-utskick" till projektets kund.',
  'epost',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'd1',
        'type', 'data:projekt',
        'label', 'Projektdata',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'a1',
        'type', 'action:send-epost',
        'label', 'Skicka offert-mejl',
        'config', jsonb_build_object(
          'mall_id', m.id::text,
          'till_source', 'kund_email'
        ),
        'position', 1
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'd1', 'to', 'a1')
    )
  ),
  true,
  100
FROM epost_mallar m
WHERE m.namn = 'Offert-utskick'
LIMIT 1;

-- 2. Påminnelse om Faktura
INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
SELECT
  'Påminnelse om Faktura',
  'Köar en påminnelse-mejl med mallen "Påminnelse" till projektets kund. Skickas automatiskt om 7 dagar via epost-kön.',
  'epost',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'd1',
        'type', 'data:projekt',
        'label', 'Projektdata',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'a1',
        'type', 'action:queue-epost',
        'label', 'Köa påminnelse',
        'config', jsonb_build_object(
          'mall_id', m.id::text,
          'till_source', 'kund_email',
          'schemalagd_om_minuter', 10080
        ),
        'position', 1
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'd1', 'to', 'a1')
    )
  ),
  true,
  110
FROM epost_mallar m
WHERE m.namn = 'Påminnelse'
LIMIT 1;

-- 3. Tackmail efter avslutat projekt
INSERT INTO workflows (namn, beskrivning, kategori, definition, aktiv, sortering)
SELECT
  'Tackmail efter avslutat projekt',
  'Skickar ett tackmejl med mallen "Tackmail" till projektets kund.',
  'epost',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'd1',
        'type', 'data:projekt',
        'label', 'Projektdata',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'a1',
        'type', 'action:send-epost',
        'label', 'Skicka tackmejl',
        'config', jsonb_build_object(
          'mall_id', m.id::text,
          'till_source', 'kund_email'
        ),
        'position', 1
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'd1', 'to', 'a1')
    )
  ),
  true,
  120
FROM epost_mallar m
WHERE m.namn = 'Tackmail'
LIMIT 1;
