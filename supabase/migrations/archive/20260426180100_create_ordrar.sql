-- Order (ÄTA — ändrings- eller tilläggsarbete).
-- Dokument som beskriver extra arbete utanför projektets ursprungliga budget,
-- vilket kunden måste godkänna och signera digitalt innan utförande.

CREATE SEQUENCE order_nummer_seq START 1;

CREATE OR REPLACE FUNCTION nextval_order_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT nextval('order_nummer_seq');
$$;

CREATE OR REPLACE FUNCTION peek_order_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
  FROM order_nummer_seq;
$$;

CREATE TABLE ordrar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_nummer    text NOT NULL UNIQUE,
  projekt_id      uuid NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  kund_id         uuid NOT NULL REFERENCES kunder(id),
  kund_namn       text NOT NULL,
  kund_org_nr     text DEFAULT '',
  titel           text NOT NULL,
  beskrivning     text DEFAULT '',
  status          text NOT NULL DEFAULT 'Utkast'
                  CHECK (status IN ('Utkast', 'Skickad', 'Godkänd', 'Avvisad')),
  belopp_netto    numeric(12,2) NOT NULL DEFAULT 0,
  belopp_moms     numeric(12,2) NOT NULL DEFAULT 0,
  belopp_total    numeric(12,2) NOT NULL DEFAULT 0,
  godkand_av      text,
  godkand_datum   timestamptz,
  signatur_data   text,
  skapad_at       timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ordrar_projekt_id ON ordrar(projekt_id);
CREATE INDEX idx_ordrar_status ON ordrar(status);
CREATE INDEX idx_ordrar_kund_id ON ordrar(kund_id);

CREATE TABLE order_rader (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES ordrar(id) ON DELETE CASCADE,
  beskrivning   text NOT NULL DEFAULT '',
  antal         numeric(12,2) NOT NULL DEFAULT 1,
  enhet         text NOT NULL DEFAULT 'st',
  a_pris        numeric(12,2) NOT NULL DEFAULT 0,
  belopp        numeric(12,2) NOT NULL DEFAULT 0,
  sortering     int NOT NULL DEFAULT 0,
  skapad_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_rader_order_id ON order_rader(order_id);

CREATE TRIGGER ordrar_updated_at
  BEFORE UPDATE ON ordrar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
