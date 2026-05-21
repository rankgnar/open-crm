-- Standardvärden för lokala fakturor används inte längre — fakturor skapas i Fortnox.
ALTER TABLE app_installningar DROP COLUMN IF EXISTS faktura_std_betalningsvillkor;
ALTER TABLE app_installningar DROP COLUMN IF EXISTS faktura_std_konto;
ALTER TABLE app_installningar DROP COLUMN IF EXISTS faktura_std_moms_procent;
