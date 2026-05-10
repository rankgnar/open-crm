CREATE OR REPLACE FUNCTION setval_forslag_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('forslag_nummer_seq', new_value, false);
$$;
