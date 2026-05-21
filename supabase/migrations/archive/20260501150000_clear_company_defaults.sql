-- Remove customer-specific defaults from app_installningar so fresh installs
-- of OpenCRM never seed the company name or org number of the original tenant.
-- Existing rows are unaffected — this only rewrites the column defaults.
ALTER TABLE app_installningar
  ALTER COLUMN foretag_namn       SET DEFAULT '',
  ALTER COLUMN foretag_org_nummer SET DEFAULT '';
