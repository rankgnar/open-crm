CREATE OR REPLACE FUNCTION nextval_kunder_nummer()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('kunder_nummer_seq');
$$;

CREATE OR REPLACE FUNCTION peek_kunder_nummer()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
  FROM kunder_nummer_seq;
$$;

CREATE OR REPLACE FUNCTION setval_kunder_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('kunder_nummer_seq', new_value, false);
$$;
