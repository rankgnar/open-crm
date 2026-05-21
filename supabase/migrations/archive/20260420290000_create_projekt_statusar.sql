CREATE TABLE projekt_statusar (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn      text NOT NULL UNIQUE,
  farg      text NOT NULL DEFAULT 'muted',
  sortering int NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO projekt_statusar (namn, farg, sortering) VALUES
  ('Planering', 'blue',    0),
  ('Aktiv',     'emerald', 1),
  ('Pausad',    'amber',   2),
  ('Klar',      'muted',   3),
  ('Avbruten',  'red',     4);
