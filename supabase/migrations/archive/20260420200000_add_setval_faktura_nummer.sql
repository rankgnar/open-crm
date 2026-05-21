CREATE OR REPLACE FUNCTION setval_faktura_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('faktura_nummer_seq', new_value, false);
$$;
