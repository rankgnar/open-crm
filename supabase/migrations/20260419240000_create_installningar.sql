-- App-wide settings (single row)
CREATE TABLE app_installningar (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Företag
  foretag_namn                  TEXT NOT NULL DEFAULT '',
  foretag_org_nummer            TEXT NOT NULL DEFAULT '',
  foretag_adress                TEXT NOT NULL DEFAULT '',
  foretag_postnummer            TEXT NOT NULL DEFAULT '',
  foretag_stad                  TEXT NOT NULL DEFAULT '',
  foretag_land                  TEXT NOT NULL DEFAULT 'Sverige',
  foretag_telefon               TEXT NOT NULL DEFAULT '',
  foretag_email                 TEXT NOT NULL DEFAULT '',
  foretag_webbadress            TEXT NOT NULL DEFAULT '',
  foretag_bankgiro              TEXT NOT NULL DEFAULT '',
  foretag_plusgiro              TEXT NOT NULL DEFAULT '',
  foretag_momsreg_nummer        TEXT NOT NULL DEFAULT '',
  -- Kunder defaults
  kund_std_land                 TEXT NOT NULL DEFAULT 'Sverige',
  kund_std_landskod             TEXT NOT NULL DEFAULT 'SE',
  kund_std_status               TEXT NOT NULL DEFAULT 'potentiell',
  -- Projekt defaults
  projekt_std_betalningsvillkor TEXT NOT NULL DEFAULT '30 dagar netto',
  projekt_std_rot_procent       NUMERIC NOT NULL DEFAULT 30,
  -- Förslag defaults
  forslag_std_moms_procent      NUMERIC NOT NULL DEFAULT 25,
  forslag_std_giltig_dagar      INTEGER NOT NULL DEFAULT 30,
  -- Faktura defaults
  faktura_std_betalningsvillkor INTEGER NOT NULL DEFAULT 30,
  faktura_std_konto             INTEGER NOT NULL DEFAULT 3001,
  faktura_std_moms_procent      NUMERIC NOT NULL DEFAULT 25,
  -- ROT-avdrag caps
  rot_avdrag_tak_enkel          NUMERIC NOT NULL DEFAULT 50000,
  rot_avdrag_tak_dubbel         NUMERIC NOT NULL DEFAULT 100000,
  -- Fortnox integration
  fortnox_client_id             TEXT NOT NULL DEFAULT '',
  fortnox_client_secret         TEXT NOT NULL DEFAULT '',
  fortnox_access_token          TEXT NOT NULL DEFAULT '',
  fortnox_refresh_token         TEXT NOT NULL DEFAULT '',
  fortnox_token_expires_at      BIGINT,
  -- Google integration
  google_client_id              TEXT NOT NULL DEFAULT '',
  google_client_secret          TEXT NOT NULL DEFAULT '',
  google_access_token           TEXT NOT NULL DEFAULT '',
  google_refresh_token          TEXT NOT NULL DEFAULT '',
  -- Zoho integration
  zoho_client_id                TEXT NOT NULL DEFAULT '',
  zoho_client_secret            TEXT NOT NULL DEFAULT '',
  zoho_access_token             TEXT NOT NULL DEFAULT '',
  zoho_refresh_token            TEXT NOT NULL DEFAULT '',
  -- AI
  ai_enabled                    BOOLEAN NOT NULL DEFAULT false,
  ai_provider                   TEXT NOT NULL DEFAULT 'anthropic',
  ai_model                      TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  ai_api_key                    TEXT NOT NULL DEFAULT '',
  skapad_at                     TIMESTAMPTZ DEFAULT now(),
  uppdaterad_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER app_installningar_updated_at
  BEFORE UPDATE ON app_installningar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed default row
INSERT INTO app_installningar DEFAULT VALUES;

-- Labor roles catalog
CREATE TABLE arbets_roller (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn      TEXT NOT NULL,
  timpris   NUMERIC NOT NULL DEFAULT 0,
  enhet     TEXT NOT NULL DEFAULT 'tim',
  aktiv     BOOLEAN NOT NULL DEFAULT true,
  sortering INTEGER NOT NULL DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

-- Articles catalog (Fortnox-compatible)
CREATE TABLE artiklar (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number TEXT UNIQUE,
  beskrivning    TEXT NOT NULL,
  enhet          TEXT NOT NULL DEFAULT 'st',
  a_pris         NUMERIC NOT NULL DEFAULT 0,
  moms_procent   NUMERIC NOT NULL DEFAULT 25,
  account_number INTEGER NOT NULL DEFAULT 3001,
  aktiv          BOOLEAN NOT NULL DEFAULT true,
  skapad_at      TIMESTAMPTZ DEFAULT now()
);

-- Suppliers catalog
CREATE TABLE leverantorer (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn          TEXT NOT NULL,
  kontaktperson TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  telefon       TEXT NOT NULL DEFAULT '',
  webbadress    TEXT NOT NULL DEFAULT '',
  org_nummer    TEXT NOT NULL DEFAULT '',
  anteckning    TEXT NOT NULL DEFAULT '',
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  skapad_at     TIMESTAMPTZ DEFAULT now()
);

-- Phase templates
CREATE TABLE fas_mallar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn        TEXT NOT NULL,
  beskrivning TEXT NOT NULL DEFAULT '',
  aktiv       BOOLEAN NOT NULL DEFAULT true,
  sortering   INTEGER NOT NULL DEFAULT 0,
  skapad_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fas_mall_faser (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mall_id   UUID NOT NULL REFERENCES fas_mallar(id) ON DELETE CASCADE,
  namn      TEXT NOT NULL,
  sortering INTEGER NOT NULL DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fas_mall_subfaser (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fas_id    UUID NOT NULL REFERENCES fas_mall_faser(id) ON DELETE CASCADE,
  namn      TEXT NOT NULL,
  sortering INTEGER NOT NULL DEFAULT 0,
  skapad_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fas_mall_faser_mall_id    ON fas_mall_faser(mall_id);
CREATE INDEX idx_fas_mall_subfaser_fas_id  ON fas_mall_subfaser(fas_id);
