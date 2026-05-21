CREATE TABLE epost_ko (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alias_id uuid REFERENCES epost_alias(id) ON DELETE SET NULL,
  mall_id uuid REFERENCES epost_mallar(id) ON DELETE SET NULL,
  till text NOT NULL,
  cc text DEFAULT '',
  amne text NOT NULL DEFAULT '',
  kropp_html text NOT NULL DEFAULT '',
  bilagor jsonb NOT NULL DEFAULT '[]'::jsonb,
  kund_id uuid REFERENCES kunder(id) ON DELETE SET NULL,
  projekt_id uuid REFERENCES projekt(id) ON DELETE SET NULL,
  forslag_id uuid REFERENCES forslag(id) ON DELETE SET NULL,
  faktura_id uuid REFERENCES fakturor(id) ON DELETE SET NULL,
  schemalagd_till timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'väntar' CHECK (status IN ('väntar', 'skickar', 'skickat', 'misslyckades')),
  forsok integer NOT NULL DEFAULT 0,
  fel_meddelande text DEFAULT '',
  skapad_at timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at timestamptz NOT NULL DEFAULT now(),
  skickad_at timestamptz
);

CREATE TRIGGER epost_ko_updated_at
  BEFORE UPDATE ON epost_ko
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX epost_ko_due_idx ON epost_ko (status, schemalagd_till) WHERE status = 'väntar';
