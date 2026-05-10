-- Fix mutable search_path on all functions flagged by Supabase Security Advisor.
-- This is a metadata-only change — no functional behavior is altered.

-- Trigger functions
ALTER FUNCTION update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_personal_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION kvitton_set_uppdaterad_at() SET search_path = public, pg_temp;
ALTER FUNCTION protect_inbyggd_statusar() SET search_path = public, pg_temp;

-- Kunder sequence
ALTER FUNCTION nextval_kunder_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_kunder_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_kunder_nummer(bigint) SET search_path = public, pg_temp;

-- Projekt sequence
ALTER FUNCTION nextval_projekt_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_projekt_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_projekt_nummer(bigint) SET search_path = public, pg_temp;

-- Forslag sequence
ALTER FUNCTION nextval_forslag_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_forslag_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_forslag_nummer(bigint) SET search_path = public, pg_temp;

-- Order sequence
ALTER FUNCTION nextval_order_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_order_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_order_nummer(bigint) SET search_path = public, pg_temp;

-- ATA sequence
ALTER FUNCTION nextval_ata_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_ata_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_ata_nummer(bigint) SET search_path = public, pg_temp;

-- Personal sequence
ALTER FUNCTION nextval_personal_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION peek_personal_nummer() SET search_path = public, pg_temp;
ALTER FUNCTION setval_personal_nummer(bigint) SET search_path = public, pg_temp;

-- Utility functions
ALTER FUNCTION find_material_candidates(text, float, int) SET search_path = public, pg_temp;
ALTER FUNCTION inject_template_vars(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION normalize_personnummer(text) SET search_path = public, pg_temp;
ALTER FUNCTION format_personnummer(text) SET search_path = public, pg_temp;
