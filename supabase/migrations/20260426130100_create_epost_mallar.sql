CREATE TABLE epost_mallar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  namn text NOT NULL,
  amne text NOT NULL DEFAULT '',
  kropp_html text NOT NULL DEFAULT '',
  kategori text NOT NULL DEFAULT 'Allmänt',
  alias_id uuid REFERENCES epost_alias(id) ON DELETE SET NULL,
  bilaga_typ text NOT NULL DEFAULT 'ingen' CHECK (bilaga_typ IN ('ingen', 'offert_pdf', 'faktura_pdf')),
  aktiv boolean NOT NULL DEFAULT true,
  sortering integer NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER epost_mallar_updated_at
  BEFORE UPDATE ON epost_mallar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
