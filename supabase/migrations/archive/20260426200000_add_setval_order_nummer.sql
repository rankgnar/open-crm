-- Möjliggör manuell återställning av order_nummer-sekvensen från Inställningar.
CREATE OR REPLACE FUNCTION setval_order_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('order_nummer_seq', new_value, false);
$$;
