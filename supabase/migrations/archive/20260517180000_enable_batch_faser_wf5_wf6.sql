-- Enable batch_faser on WF5 and WF6 ai:generate nodes.
-- Without batching, large projects (many subfases) cause the AI response to exceed
-- the model's max_tokens limit, resulting in truncated JSON that cannot be parsed.
-- batch_faser=true splits valda_subfaser into groups of batch_size and merges results.

-- WF5: Estimera arbetskostnad — merges "estimat" arrays (default)
UPDATE workflows
SET definition = jsonb_set(
  definition,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN node->>'type' = 'ai:generate'
        THEN jsonb_set(
               jsonb_set(node, '{config,batch_faser}', 'true'::jsonb),
               '{config,batch_size}', '5'::jsonb
             )
        ELSE node
      END
    )
    FROM jsonb_array_elements(definition->'nodes') AS node
  )
)
WHERE namn = '5-Estimera arbetskostnad';

-- WF6: Estimera materialbehov — merges "material" arrays
UPDATE workflows
SET definition = jsonb_set(
  definition,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN node->>'type' = 'ai:generate'
        THEN jsonb_set(
               jsonb_set(
                 jsonb_set(node, '{config,batch_faser}', 'true'::jsonb),
                 '{config,batch_size}', '5'::jsonb
               ),
               '{config,batch_merge_key}', '"material"'::jsonb
             )
        ELSE node
      END
    )
    FROM jsonb_array_elements(definition->'nodes') AS node
  )
)
WHERE namn = '6-Estimera materialbehov';
