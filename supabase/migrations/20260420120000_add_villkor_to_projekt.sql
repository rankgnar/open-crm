-- Add villkor to projekt table
ALTER TABLE projekt ADD COLUMN IF NOT EXISTS villkor text;

-- Add default villkor to app_installningar
ALTER TABLE app_installningar ADD COLUMN IF NOT EXISTS projekt_std_villkor text NOT NULL DEFAULT '';
