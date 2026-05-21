CREATE TABLE faktura_statusar (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn      text NOT NULL UNIQUE,
  farg      text NOT NULL DEFAULT 'muted',
  sortering int NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO faktura_statusar (namn, farg, sortering) VALUES
  ('Utkast',   'muted',   0),
  ('Skickad',  'blue',    1),
  ('Obetald',  'amber',   2),
  ('Betald',   'emerald', 3),
  ('Förfallen','red',     4);
