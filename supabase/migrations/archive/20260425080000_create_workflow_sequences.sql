CREATE TABLE workflow_sequences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn         text NOT NULL,
  beskrivning  text NOT NULL DEFAULT '',
  workflow_ids jsonb NOT NULL DEFAULT '[]',
  aktiv        boolean NOT NULL DEFAULT true,
  skapad_at    timestamptz DEFAULT now()
);

ALTER TABLE workflow_triggers
  ADD COLUMN IF NOT EXISTS sequence_id uuid
  REFERENCES workflow_sequences(id) ON DELETE SET NULL;
