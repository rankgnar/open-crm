-- Fakturor lokala tabeller tas bort: fakturor genereras nu i Fortnox.
-- Endast fakturaplan_snapshots behålls (planering av etapper per förslag).

DROP TABLE IF EXISTS faktura_rader CASCADE;
DROP TABLE IF EXISTS fakturor CASCADE;
DROP TABLE IF EXISTS faktura_statusar CASCADE;

DROP FUNCTION IF EXISTS nextval_faktura_nummer();
DROP FUNCTION IF EXISTS peek_faktura_nummer();
DROP FUNCTION IF EXISTS setval_faktura_nummer(bigint);

DROP SEQUENCE IF EXISTS faktura_nummer_seq;
