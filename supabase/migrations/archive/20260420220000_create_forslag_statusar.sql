CREATE TABLE forslag_statusar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn text NOT NULL,
  farg text NOT NULL DEFAULT 'muted',
  sortering int NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO forslag_statusar (namn, farg, sortering) VALUES
  ('Utkast',     'muted',   0),
  ('Skickat',    'blue',    1),
  ('Accepterat', 'emerald', 2),
  ('Avvisat',    'red',     3);

UPDATE forslag SET status = 'Utkast'     WHERE status = 'utkast';
UPDATE forslag SET status = 'Skickat'    WHERE status = 'skickat';
UPDATE forslag SET status = 'Accepterat' WHERE status = 'accepterat';
UPDATE forslag SET status = 'Avvisat'    WHERE status = 'avvisat';

UPDATE app_installningar SET kund_std_status = 'Utkast' WHERE kund_std_status = 'utkast';
