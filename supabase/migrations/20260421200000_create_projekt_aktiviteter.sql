CREATE TABLE projekt_aktiviteter (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  projekt_id uuid NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  text text NOT NULL,
  skapad_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON projekt_aktiviteter(projekt_id);
