-- revisor_deadlines: fechas clave con el revisor
CREATE TABLE IF NOT EXISTS revisor_deadlines (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titel        TEXT        NOT NULL,
  datum        DATE        NOT NULL,
  typ          TEXT        NOT NULL DEFAULT 'ovrig',
  status       TEXT        NOT NULL DEFAULT 'kommande',
  notat        TEXT,
  skapad_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uppdaterad_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- revisor_anteckningar: notas sobre el revisor
CREATE TABLE IF NOT EXISTS revisor_anteckningar (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titel        TEXT        NOT NULL,
  innehall     TEXT        NOT NULL DEFAULT '',
  farg         TEXT        NOT NULL DEFAULT 'muted',
  skapad_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uppdaterad_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- revisor_dokument: documentos compartidos con el revisor
CREATE TABLE IF NOT EXISTS revisor_dokument (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filnamn      TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  mime_type    TEXT        NOT NULL,
  storlek      INTEGER     NOT NULL,
  skapad_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage bucket para documentos del revisor
INSERT INTO storage.buckets (id, name, public)
VALUES ('revisor-dokument', 'revisor-dokument', false)
ON CONFLICT (id) DO NOTHING;
