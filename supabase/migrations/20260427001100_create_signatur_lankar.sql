-- Public signing links: each row represents a unique URL sent to a customer
-- to review and sign a forslag or order. Holds a full audit trail.

CREATE TABLE IF NOT EXISTS signatur_lankar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT UNIQUE NOT NULL,
  dokument_typ  TEXT NOT NULL CHECK (dokument_typ IN ('forslag', 'order')),
  dokument_id   UUID NOT NULL,
  kund_id       UUID REFERENCES kunder(id) ON DELETE SET NULL,
  kund_email    TEXT NOT NULL,
  dokument_hash TEXT NOT NULL DEFAULT '',
  meddelande    TEXT,
  skapad_av     TEXT,
  skapad_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  gar_ut_at     TIMESTAMPTZ NOT NULL,
  oppnad_at     TIMESTAMPTZ,
  signerad_at   TIMESTAMPTZ,
  signerad_namn TEXT,
  signerad_ip   INET,
  signerad_ua   TEXT,
  signatur_data TEXT,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signatur_lankar_token   ON signatur_lankar(token);
CREATE INDEX IF NOT EXISTS idx_signatur_lankar_doc     ON signatur_lankar(dokument_typ, dokument_id);
CREATE INDEX IF NOT EXISTS idx_signatur_lankar_pending ON signatur_lankar(signerad_at) WHERE signerad_at IS NULL;
