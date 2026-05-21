CREATE TABLE workflows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn          text NOT NULL,
  beskrivning   text NOT NULL DEFAULT '',
  kategori      text NOT NULL DEFAULT 'forslag',
  definition    jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  version       int NOT NULL DEFAULT 1,
  aktiv         boolean NOT NULL DEFAULT true,
  sortering     int NOT NULL DEFAULT 0,
  skapad_at     timestamptz DEFAULT now(),
  uppdaterad_at timestamptz DEFAULT now()
);

CREATE TABLE workflow_triggers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  seccion     text NOT NULL,
  etikett     text NOT NULL,
  icon        text NOT NULL DEFAULT 'Zap',
  sortering   int NOT NULL DEFAULT 0,
  skapad_at   timestamptz DEFAULT now()
);

CREATE TABLE workflow_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual',
  status       text NOT NULL DEFAULT 'kör'
                 CHECK (status IN ('kör', 'klar', 'fel', 'avbruten')),
  input_json   jsonb NOT NULL DEFAULT '{}',
  output_json  jsonb,
  node_results jsonb NOT NULL DEFAULT '{}',
  error_node   text,
  error_msg    text,
  startad_at   timestamptz DEFAULT now(),
  avslutad_at  timestamptz,
  duration_ms  int
);

CREATE INDEX idx_wf_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_wf_runs_startad_at  ON workflow_runs(startad_at DESC);
CREATE INDEX idx_wf_triggers_seccion ON workflow_triggers(seccion);
