-- Track how the employee got to the project: public transport or company car.
ALTER TABLE personal_tidrapport
  ADD COLUMN transportmedel TEXT;

-- Backfill existing rows (small dataset, default to firmabil as the typical case).
UPDATE personal_tidrapport SET transportmedel = 'firmabil' WHERE transportmedel IS NULL;

ALTER TABLE personal_tidrapport
  ALTER COLUMN transportmedel SET NOT NULL,
  ADD CONSTRAINT personal_tidrapport_transportmedel_check
    CHECK (transportmedel IN ('kollektivtrafik', 'firmabil'));
