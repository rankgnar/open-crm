ALTER TABLE projekt
  ADD COLUMN IF NOT EXISTS arbetsplats_adress TEXT,
  ADD COLUMN IF NOT EXISTS arbetsplats_postnummer TEXT,
  ADD COLUMN IF NOT EXISTS arbetsplats_stad TEXT,
  ADD COLUMN IF NOT EXISTS rot_avdrag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rot_procent NUMERIC(5,2) DEFAULT 30,
  ADD COLUMN IF NOT EXISTS rot_inkludera_medsokande BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS betalningsvillkor TEXT DEFAULT '30 dagar netto',
  ADD COLUMN IF NOT EXISTS interna_anteckningar TEXT;
