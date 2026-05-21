-- Sequence runs: track the lifecycle of a workflow chain so that a failed
-- chain can be resumed from the failing step instead of restarting from
-- step 1. Each row represents one attempt to run a sequence against a
-- target resource (typically a projekt).
--
-- The renderer creates a row when starting a chain, advances it after each
-- successful workflow, and marks it `fel`/`klar`/`avbruten` when the chain
-- ends. On the next trigger, the UI looks for an open `fel` row matching
-- (sequence_id, projekt_id) and offers to resume from `current_step`.
--
-- `workflow_ids` is a snapshot of the chain at start-time so that later
-- edits to the sequence definition do not invalidate an in-flight resume.
-- `collected_input` stores the merged output of all completed steps so the
-- next step receives the same input it would have received in a fresh run.

CREATE TABLE sequence_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id       uuid REFERENCES workflow_sequences(id) ON DELETE CASCADE,
  trigger_id        uuid REFERENCES workflow_triggers(id) ON DELETE SET NULL,
  projekt_id        uuid,
  workflow_ids      jsonb NOT NULL DEFAULT '[]',
  current_step      int NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'kör',
  workflow_run_ids  jsonb NOT NULL DEFAULT '[]',
  collected_input   jsonb NOT NULL DEFAULT '{}',
  error_step        int,
  error_msg         text,
  startad_at        timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at     timestamptz NOT NULL DEFAULT now(),
  avslutad_at       timestamptz,
  CONSTRAINT sequence_runs_status_chk
    CHECK (status IN ('kör', 'klar', 'fel', 'avbruten'))
);

-- The "find a resumable run" query: latest failed run for a given
-- (sequence, projekt) pair. Partial index keeps it tiny.
CREATE INDEX sequence_runs_resumable_idx
  ON sequence_runs (sequence_id, projekt_id, uppdaterad_at DESC)
  WHERE status = 'fel';

-- General lookup by sequence (history view).
CREATE INDEX sequence_runs_sequence_idx
  ON sequence_runs (sequence_id, startad_at DESC);
