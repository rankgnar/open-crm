-- Drop old date-only unique constraint and its matching index
ALTER TABLE personal_tidrapport
  DROP CONSTRAINT IF EXISTS personal_tidrapport_personal_datum_unique;
DROP INDEX IF EXISTS personal_tidrapport_personal_datum_unique;

-- One entry per (employee, day, project) when projekt_id is set
ALTER TABLE personal_tidrapport
  ADD CONSTRAINT personal_tidrapport_personal_datum_projekt_unique
  UNIQUE (personal_id, datum, projekt_id);

-- One no-project entry per (employee, day) — NULL != NULL in UNIQUE so a partial index is needed
CREATE UNIQUE INDEX personal_tidrapport_personal_datum_null_projekt_unique
  ON personal_tidrapport (personal_id, datum)
  WHERE projekt_id IS NULL;
