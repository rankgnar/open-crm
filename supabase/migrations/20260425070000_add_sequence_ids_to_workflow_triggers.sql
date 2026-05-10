ALTER TABLE workflow_triggers ALTER COLUMN workflow_id DROP NOT NULL;
ALTER TABLE workflow_triggers ADD COLUMN IF NOT EXISTS sequence_ids jsonb DEFAULT NULL;
