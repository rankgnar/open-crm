-- Rename förslagskedje-workflows so they get the "N-" prefix used by every
-- migration from 20260427130000 onwards. The seed migrations created them
-- without the prefix; Cloud was renamed manually in Studio, self-hosted
-- never had the rename — every later migration that looks up a workflow by
-- exact namn would fail with "hittades inte".
--
-- Idempotent: each UPDATE matches the OLD unprefixed name, so on Cloud
-- (already prefixed) every statement is a no-op.

UPDATE workflows SET namn = '1-Analysera projektets scope'      WHERE namn = 'Analysera projektets scope';
UPDATE workflows SET namn = '2-Analysera projektdokument'       WHERE namn = 'Analysera projektdokument';
UPDATE workflows SET namn = '3-Identifiera projekttyp och faser' WHERE namn = 'Identifiera projekttyp och faser';
UPDATE workflows SET namn = '4-Skapa förslag med faser'         WHERE namn = 'Skapa förslag med faser';
UPDATE workflows SET namn = '5-Estimera arbetskostnad'          WHERE namn = 'Estimera arbetskostnad';
UPDATE workflows SET namn = '6-Estimera materialbehov'          WHERE namn = 'Estimera materialbehov';
UPDATE workflows SET namn = '7-Matcha material mot katalog'     WHERE namn = 'Matcha material mot katalog';
UPDATE workflows SET namn = '8-Sök materialpris på webben'      WHERE namn = 'Sök materialpris på webben';
UPDATE workflows SET namn = '9-Fyll i förslag med kostnader'    WHERE namn = 'Fyll i förslag med kostnader';
UPDATE workflows SET namn = '10-Generera tidplan från förslag'  WHERE namn = 'Generera tidplan från förslag';
