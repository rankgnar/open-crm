-- Generic {{key}} substitution. Used by RPCs that need to render epost-mallar
-- with runtime values without leaving plpgsql.

CREATE OR REPLACE FUNCTION inject_template_vars(template TEXT, vars jsonb)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT := COALESCE(template, '');
  k TEXT;
BEGIN
  IF vars IS NULL THEN RETURN result; END IF;
  FOR k IN SELECT jsonb_object_keys(vars) LOOP
    result := replace(result, '{{' || k || '}}', COALESCE(vars->>k, ''));
  END LOOP;
  RETURN result;
END;
$$;
