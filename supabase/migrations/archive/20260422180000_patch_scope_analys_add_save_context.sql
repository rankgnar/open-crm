UPDATE workflows
SET
  definition = jsonb_set(
    jsonb_set(
      definition,
      '{nodes}',
      definition->'nodes' || '[{
        "id": "n4",
        "type": "action:save-context",
        "label": "Spara scope-analys",
        "config": { "nyckel": "scope_analys", "source_key": "ai_raw" },
        "position": 3
      }]'::jsonb
    ),
    '{edges}',
    definition->'edges' || '[{"from": "n3", "to": "n4"}]'::jsonb
  ),
  uppdaterad_at = now()
WHERE namn = 'Analysera projektets scope';
