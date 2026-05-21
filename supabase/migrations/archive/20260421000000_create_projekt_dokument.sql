CREATE TABLE projekt_dokument (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  projekt_id uuid NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  filnamn text NOT NULL,
  mime_type text NOT NULL,
  storlek bigint NOT NULL,
  storage_path text NOT NULL,
  skapad_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON projekt_dokument(projekt_id);
