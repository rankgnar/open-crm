-- Enable trigram similarity search for material_katalog
-- Used by action:match-material-katalog workflow node (step 4 in matching cascade)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_material_katalog_namn_trgm
  ON material_katalog USING gin(namn gin_trgm_ops);

-- Returns candidates ordered by similarity score (descending).
-- p_min_similarity: 0.35 for confident trigram match, 0.1 for AI fallback candidates
CREATE OR REPLACE FUNCTION find_material_candidates(
  p_sokterm        text,
  p_min_similarity float DEFAULT 0.35,
  p_limit          int   DEFAULT 1
)
RETURNS TABLE(
  id               uuid,
  artikel_nummer   text,
  namn             text,
  enhet            text,
  a_pris           float8,
  leverantor_id    uuid,
  similarity_score float8
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    artikel_nummer,
    namn,
    enhet,
    a_pris::float8,
    leverantor_id,
    similarity(namn, p_sokterm)::float8 AS similarity_score
  FROM material_katalog
  WHERE aktiv = true
    AND similarity(namn, p_sokterm) >= p_min_similarity
  ORDER BY similarity_score DESC
  LIMIT p_limit;
$$;
