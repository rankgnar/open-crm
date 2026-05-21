ALTER TABLE kunder DROP CONSTRAINT IF EXISTS kunder_status_check;

CREATE TABLE kund_statusar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn text NOT NULL,
  farg text NOT NULL DEFAULT 'muted',
  sortering int NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO kund_statusar (namn, farg, sortering) VALUES
  ('Ny Kund', 'blue', 0),
  ('Aktiv',   'emerald', 1),
  ('Inaktiv', 'muted', 2);

-- Migrate existing kunder to new status names
UPDATE kunder SET status = 'Ny Kund' WHERE status = 'potentiell';
UPDATE kunder SET status = 'Aktiv'   WHERE status = 'aktiv';
UPDATE kunder SET status = 'Inaktiv' WHERE status = 'inaktiv';

-- Migrate config default
UPDATE app_installningar SET kund_std_status = 'Ny Kund' WHERE kund_std_status = 'potentiell';
UPDATE app_installningar SET kund_std_status = 'Aktiv'   WHERE kund_std_status = 'aktiv';
UPDATE app_installningar SET kund_std_status = 'Inaktiv' WHERE kund_std_status = 'inaktiv';
