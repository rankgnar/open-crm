-- Fortnox-compatible invoice schema
-- Column names map 1:1 to Fortnox API PascalCase fields (snake_case here)

CREATE TABLE fakturor (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Internal links
  projekt_id            UUID REFERENCES projekt(id) ON DELETE SET NULL,
  forslag_id            UUID REFERENCES forslag(id) ON DELETE SET NULL,

  -- Internal status (separate from Fortnox Booked/Sent/Cancelled flags)
  status                TEXT NOT NULL DEFAULT 'utkast'
                        CHECK (status IN ('utkast', 'skickad', 'betald', 'förfallad')),

  -- Fortnox: DocumentNumber
  document_number       TEXT UNIQUE,

  -- Fortnox: CustomerNumber
  customer_number       TEXT,

  -- Fortnox: InvoiceType — INVOICE | CASHINVOICE
  invoice_type          TEXT NOT NULL DEFAULT 'INVOICE',

  -- Fortnox: InvoiceDate / DueDate
  invoice_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date              DATE,

  -- Fortnox: TermsOfPayment
  terms_of_payment      TEXT DEFAULT '30',

  -- Fortnox: OurReference / YourReference / YourOrderNumber
  our_reference         TEXT DEFAULT '',
  your_reference        TEXT DEFAULT '',
  your_order_number     TEXT DEFAULT '',

  -- Fortnox: HouseWork / HouseWorkType (ROT/RUT)
  house_work            BOOLEAN DEFAULT false,
  house_work_type       TEXT,

  -- Fortnox: Currency / VATIncluded
  currency              TEXT DEFAULT 'SEK',
  vat_included          BOOLEAN DEFAULT false,

  -- Fortnox: Remarks (footer text)
  remarks               TEXT DEFAULT '',

  -- Fortnox: AdministrationFee / Freight
  administration_fee    NUMERIC(12,2) DEFAULT 0,
  freight               NUMERIC(12,2) DEFAULT 0,

  -- Customer snapshot (denormalized — Fortnox Address1, City, ZipCode, etc.)
  customer_name         TEXT NOT NULL DEFAULT '',
  organisation_number   TEXT DEFAULT '',
  address1              TEXT DEFAULT '',
  address2              TEXT DEFAULT '',
  city                  TEXT DEFAULT '',
  zip_code              TEXT DEFAULT '',
  country               TEXT DEFAULT 'Sverige',
  phone1                TEXT DEFAULT '',
  email_invoice         TEXT DEFAULT '',
  email_invoice_cc      TEXT DEFAULT '',

  skapad_at             TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fakturor_projekt_id ON fakturor(projekt_id);
CREATE INDEX idx_fakturor_status     ON fakturor(status);

CREATE TABLE faktura_rader (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faktura_id                  UUID NOT NULL REFERENCES fakturor(id) ON DELETE CASCADE,

  -- Fortnox: RowId (sort order)
  row_id                      INTEGER DEFAULT 0,

  -- Fortnox: ArticleNumber / Description
  article_number              TEXT DEFAULT '',
  description                 TEXT NOT NULL DEFAULT '',

  -- Fortnox: DeliveredQuantity / Unit
  delivered_quantity          NUMERIC(10,2) DEFAULT 1,
  unit                        TEXT DEFAULT 'st',

  -- Fortnox: Price (excl. VAT) / Discount / DiscountType
  price                       NUMERIC(12,2) DEFAULT 0,
  discount                    NUMERIC(10,2) DEFAULT 0,
  discount_type               TEXT DEFAULT 'PERCENT',

  -- Fortnox: VAT (%) / AccountNumber
  vat                         NUMERIC(5,2) DEFAULT 25,
  account_number              INTEGER DEFAULT 3001,

  -- Fortnox: HouseWork / HouseWorkType / HouseWorkHoursToReport
  house_work                  BOOLEAN DEFAULT false,
  house_work_type             TEXT,
  house_work_hours_to_report  NUMERIC(10,2) DEFAULT 0,

  -- Fortnox: CostCenter / Project
  cost_center                 TEXT DEFAULT '',
  project                     TEXT DEFAULT '',

  skapad_at                   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_faktura_rader_faktura_id ON faktura_rader(faktura_id);

-- Auto-update uppdaterad_at
CREATE TRIGGER fakturor_updated_at
  BEFORE UPDATE ON fakturor
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Faktura number sequence: F-0001 format
CREATE SEQUENCE faktura_nummer_seq START 1;

CREATE OR REPLACE FUNCTION nextval_faktura_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT nextval('faktura_nummer_seq');
$$;

CREATE OR REPLACE FUNCTION peek_faktura_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
  FROM faktura_nummer_seq;
$$;
