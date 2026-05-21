CREATE TABLE IF NOT EXISTS material_katalog (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  leverantor_id   UUID        NOT NULL REFERENCES leverantorer(id) ON DELETE CASCADE,
  artikel_nummer  TEXT,
  namn            TEXT        NOT NULL,
  namn2           TEXT,
  kategori1       TEXT,
  kategori2       TEXT,
  kategori3       TEXT,
  kategori4       TEXT,
  enhet           TEXT,
  a_pris          NUMERIC(12,4) NOT NULL DEFAULT 0,
  bredd           NUMERIC,
  tjocklek        NUMERIC,
  langd           NUMERIC,
  bild_url        TEXT,
  aktiv           BOOLEAN     NOT NULL DEFAULT TRUE,
  skapad_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uppdaterad_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS material_katalog_leverantor_idx ON material_katalog(leverantor_id);
CREATE INDEX IF NOT EXISTS material_katalog_namn_idx      ON material_katalog(lower(namn));
CREATE INDEX IF NOT EXISTS material_katalog_aktiv_idx     ON material_katalog(aktiv);

CREATE TABLE IF NOT EXISTS material_import_config (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  leverantor_id     UUID        NOT NULL REFERENCES leverantorer(id) ON DELETE CASCADE UNIQUE,
  mappings          JSONB       NOT NULL DEFAULT '{}',
  decimal_separator TEXT        NOT NULL DEFAULT ',',
  delimiter         TEXT        NOT NULL DEFAULT E'\t',
  skip_rows         INTEGER     NOT NULL DEFAULT 0,
  skapad_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uppdaterad_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
