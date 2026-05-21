CREATE OR REPLACE FUNCTION setval_projekt_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('projekt_nummer_seq', new_value, false);
$$;
