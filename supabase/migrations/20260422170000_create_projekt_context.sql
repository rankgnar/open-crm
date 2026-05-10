CREATE TABLE projekt_context (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id      UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  nyckel          TEXT NOT NULL,
  varde           TEXT NOT NULL DEFAULT '',
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  skapad_at       TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(projekt_id, nyckel)
);

CREATE INDEX idx_projekt_context_projekt_id ON projekt_context(projekt_id);
CREATE TRIGGER projekt_context_updated_at
  BEFORE UPDATE ON projekt_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
