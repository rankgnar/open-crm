ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS timmar_per_dag integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS arbetsdagar_per_vecka integer NOT NULL DEFAULT 5;
