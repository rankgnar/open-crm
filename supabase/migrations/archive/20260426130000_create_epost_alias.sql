CREATE TABLE epost_alias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  etikett text NOT NULL DEFAULT '',
  fran_namn text NOT NULL DEFAULT '',
  fran_adress text NOT NULL UNIQUE,
  signatur_html text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'zoho',
  zoho_send_mail_id text UNIQUE,
  standard boolean NOT NULL DEFAULT false,
  aktiv boolean NOT NULL DEFAULT true,
  sortering integer NOT NULL DEFAULT 0,
  skapad_at timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER epost_alias_updated_at
  BEFORE UPDATE ON epost_alias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX epost_alias_one_standard ON epost_alias (standard) WHERE standard = true;
