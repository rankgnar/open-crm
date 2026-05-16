CREATE TABLE IF NOT EXISTS bank_transaktioner (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datum         DATE NOT NULL,
  beskrivning   TEXT NOT NULL,
  belopp        NUMERIC(12,2) NOT NULL,
  saldo         NUMERIC(12,2),
  referens      TEXT,
  importerat_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (datum, beskrivning, belopp)
);
