CREATE TABLE IF NOT EXISTS forslag_fas_chat (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fas_id uuid NOT NULL REFERENCES forslag_faser(id) ON DELETE CASCADE,
  roll text NOT NULL CHECK (roll IN ('user', 'assistant')),
  innehall text NOT NULL,
  andringar jsonb,
  applied boolean NOT NULL DEFAULT false,
  skapad_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forslag_fas_chat_fas_id_idx ON forslag_fas_chat (fas_id, skapad_at);
