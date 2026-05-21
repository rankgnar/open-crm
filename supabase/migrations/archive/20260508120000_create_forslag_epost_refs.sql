CREATE TABLE forslag_epost_refs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forslag_id  UUID NOT NULL REFERENCES forslag(id) ON DELETE CASCADE,
  message_id  TEXT NOT NULL,
  folder_id   TEXT NOT NULL DEFAULT '',
  provider    TEXT NOT NULL DEFAULT 'zoho',
  amne        TEXT NOT NULL DEFAULT '',
  fran_adress TEXT NOT NULL DEFAULT '',
  fran_namn   TEXT NOT NULL DEFAULT '',
  snippet     TEXT NOT NULL DEFAULT '',
  datum       TIMESTAMPTZ NOT NULL,
  skapad_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON forslag_epost_refs(forslag_id);
