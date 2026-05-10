-- personal_tidrapport: add projekt link, approval status, and timestamp
ALTER TABLE personal_tidrapport
  ADD COLUMN projekt_id UUID REFERENCES projekt(id) ON DELETE SET NULL,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'inskickad',
  ADD COLUMN godkand_at TIMESTAMPTZ;

CREATE INDEX ON personal_tidrapport (status);
CREATE INDEX ON personal_tidrapport (projekt_id);

-- personal_ledighet: add explicit status column
ALTER TABLE personal_ledighet
  ADD COLUMN status TEXT NOT NULL DEFAULT 'inskickad';

UPDATE personal_ledighet SET status = 'godkänd' WHERE godkand = true;

CREATE INDEX ON personal_ledighet (status);

-- personal_loneposter: advances, supplements, deductions for payroll
CREATE TABLE personal_loneposter (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  typ         TEXT NOT NULL CHECK (typ IN ('förskott', 'tillägg', 'avdrag', 'traktamente', 'utlägg')),
  belopp      NUMERIC(12,2) NOT NULL,
  beskrivning TEXT NOT NULL DEFAULT '',
  datum       DATE NOT NULL,
  manad       TEXT NOT NULL,
  skapad_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON personal_loneposter (personal_id);
CREATE INDEX ON personal_loneposter (manad);
