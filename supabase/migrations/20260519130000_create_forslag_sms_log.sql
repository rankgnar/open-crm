CREATE TABLE forslag_sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forslag_id UUID NOT NULL REFERENCES forslag(id) ON DELETE CASCADE,
  mall_namn TEXT NOT NULL DEFAULT '',
  meddelande TEXT NOT NULL,
  skapad_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX forslag_sms_log_forslag_id_idx ON forslag_sms_log (forslag_id);
