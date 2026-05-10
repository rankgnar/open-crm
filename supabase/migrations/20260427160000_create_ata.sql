-- ÄTA — Ändrings- och Tilläggsarbeten. New parallel module to "Order".
-- Mirror of ordrar/order_rader so the signing flow, billing, etc. all work
-- identically, but kept separate so the user can distinguish regular orders
-- from extra work documents.

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ata_nummer_seq START 1;

CREATE OR REPLACE FUNCTION nextval_ata_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT nextval('ata_nummer_seq');
$$;

CREATE OR REPLACE FUNCTION peek_ata_nummer()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
  FROM ata_nummer_seq;
$$;

CREATE OR REPLACE FUNCTION setval_ata_nummer(new_value bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT setval('ata_nummer_seq', new_value, false);
$$;

CREATE TABLE IF NOT EXISTS ata (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_nummer      text NOT NULL UNIQUE,
  projekt_id      uuid NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  kund_id         uuid NOT NULL REFERENCES kunder(id),
  kund_namn       text NOT NULL,
  kund_org_nr     text DEFAULT '',
  titel           text NOT NULL,
  beskrivning     text DEFAULT '',
  villkor         text,
  status          text NOT NULL DEFAULT 'Utkast'
                  CHECK (status IN ('Utkast', 'Skickad', 'Godkänd', 'Avvisad')),
  belopp_netto    numeric(12,2) NOT NULL DEFAULT 0,
  belopp_moms     numeric(12,2) NOT NULL DEFAULT 0,
  belopp_total    numeric(12,2) NOT NULL DEFAULT 0,
  godkand_av      text,
  godkand_datum   timestamptz,
  signatur_data   text,
  fas_id          uuid REFERENCES forslag_faser(id)    ON DELETE SET NULL,
  subfas_id       uuid REFERENCES forslag_subfaser(id) ON DELETE SET NULL,
  skapad_at       timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ata_projekt_id ON ata(projekt_id);
CREATE INDEX IF NOT EXISTS idx_ata_status     ON ata(status);
CREATE INDEX IF NOT EXISTS idx_ata_kund_id    ON ata(kund_id);
CREATE INDEX IF NOT EXISTS idx_ata_fas_id     ON ata(fas_id);
CREATE INDEX IF NOT EXISTS idx_ata_subfas_id  ON ata(subfas_id);

CREATE TABLE IF NOT EXISTS ata_rader (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id        uuid NOT NULL REFERENCES ata(id) ON DELETE CASCADE,
  beskrivning   text NOT NULL DEFAULT '',
  antal         numeric(12,2) NOT NULL DEFAULT 1,
  enhet         text NOT NULL DEFAULT 'st',
  a_pris        numeric(12,2) NOT NULL DEFAULT 0,
  belopp        numeric(12,2) NOT NULL DEFAULT 0,
  sortering     int NOT NULL DEFAULT 0,
  skapad_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ata_rader_ata_id ON ata_rader(ata_id);

DROP TRIGGER IF EXISTS ata_updated_at ON ata;
CREATE TRIGGER ata_updated_at
  BEFORE UPDATE ON ata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Villkor templates (cascade input → kund → global) ─────────────────────

ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS ata_std_villkor TEXT NOT NULL DEFAULT '';

ALTER TABLE kunder
  ADD COLUMN IF NOT EXISTS ata_std_villkor TEXT NOT NULL DEFAULT '';

-- ── Extend signatur_lankar.dokument_typ to allow 'ata' ────────────────────

ALTER TABLE signatur_lankar
  DROP CONSTRAINT IF EXISTS signatur_lankar_dokument_typ_check;
ALTER TABLE signatur_lankar
  ADD CONSTRAINT signatur_lankar_dokument_typ_check
  CHECK (dokument_typ IN ('forslag', 'order', 'fritt', 'ata'));

-- ── Aktivitetslogg event ──────────────────────────────────────────────────

INSERT INTO aktivitetslogg_installningar (handelse, aktiv, etikett)
VALUES ('ata_signerad', true, 'ÄTA signerad')
ON CONFLICT (handelse) DO NOTHING;

-- ── PDF mall: clone existing 'order' template into 'ata' ──────────────────

INSERT INTO pdf_mallar (
  typ, namn, accent_farg, portada_titel, portada_titel_2, portada_undertitel,
  visa_portada, visa_sammanfattning, visa_schema, visa_tidplan,
  visa_arbetskostnad, visa_materialkostnad, visa_godkand_f_skatt,
  visa_leverantor_material, visa_villkor, html_mall
)
SELECT 'ata', 'ÄTA', accent_farg, portada_titel, portada_titel_2, portada_undertitel,
       visa_portada, visa_sammanfattning, visa_schema, visa_tidplan,
       visa_arbetskostnad, visa_materialkostnad, visa_godkand_f_skatt,
       visa_leverantor_material, visa_villkor, html_mall
FROM pdf_mallar WHERE typ = 'order'
ON CONFLICT (typ) DO NOTHING;

-- ── Patch submit_signature to handle dokument_typ = 'ata' ─────────────────

CREATE OR REPLACE FUNCTION submit_signature(
  p_token   TEXT,
  p_namn    TEXT,
  p_signatur TEXT,
  p_ua      TEXT,
  p_pdf_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link              signatur_lankar%ROWTYPE;
  v_ip                INET;
  v_xff               TEXT;
  v_log_aktiv         BOOLEAN;
  v_projekt_id        UUID;
  v_kund_email        TEXT;
  v_kund_namn         TEXT;
  v_doc_titel         TEXT;
  v_doc_nummer        TEXT;
  v_foretag_namn      TEXT;
  v_foretag_email     TEXT;
  v_alias_id          UUID;
  v_acepterat_exists  BOOLEAN;
  v_pdf_button        TEXT := '';
  v_pdf_admin_line    TEXT := '';
  v_doc_typ_label     TEXT;
  v_doc_typ_label_def TEXT;
  v_datum             TEXT;
  v_alias_signatur    TEXT := '';
  v_vars              jsonb;
  v_mall_kund         RECORD;
  v_mall_admin        RECORD;
  v_amne              TEXT;
  v_kropp             TEXT;
  v_use_alias         UUID;
BEGIN
  IF p_token IS NULL OR p_namn IS NULL OR length(trim(p_namn)) = 0 OR p_signatur IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET signerad_at = now(),
         signerad_namn = trim(p_namn),
         signerad_ip = v_ip,
         signerad_ua = p_ua,
         signatur_data = p_signatur,
         signed_pdf_url = p_pdf_url
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'accepterat',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;

    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
      END IF;
    END IF;
  ELSIF v_link.dokument_typ = 'order' THEN
    UPDATE ordrar
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, order_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSIF v_link.dokument_typ = 'ata' THEN
    UPDATE ata
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, ata_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    v_kund_email := v_link.kund_email;
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;

    SELECT a.foretag_namn, a.foretag_email INTO v_foretag_namn, v_foretag_email
      FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Signerad %s — %s', v_link.dokument_typ, COALESCE(v_doc_nummer, '')),
        format(
          E'Signerad av %s\n%s\nIP: %s',
          trim(p_namn),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—')
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    v_doc_typ_label     := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offert'
                              WHEN 'order'   THEN 'order'
                              WHEN 'ata'     THEN 'ÄTA-arbete'
                              ELSE v_link.dokument_typ
                            END;
    v_doc_typ_label_def := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offerten'
                              WHEN 'order'   THEN 'ordern'
                              WHEN 'ata'     THEN 'ÄTA-arbetet'
                              ELSE v_link.dokument_typ
                            END;
    v_datum             := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    IF p_pdf_url IS NOT NULL AND length(p_pdf_url) > 0 THEN
      v_pdf_button := format(
        '<p style="margin:18px 0"><a href="%s" style="display:inline-block;padding:11px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Ladda ner signerat PDF</a></p>',
        p_pdf_url
      );
      v_pdf_admin_line := format('<p>PDF: <a href="%s">%s</a></p>', p_pdf_url, p_pdf_url);
    END IF;

    v_vars := jsonb_build_object(
      'kund_namn',          COALESCE(v_kund_namn, trim(p_namn)),
      'kund_email',         COALESCE(v_kund_email, '—'),
      'foretag_namn',       COALESCE(v_foretag_namn, ''),
      'namn',               trim(p_namn),
      'doc_nummer',         COALESCE(v_doc_nummer, ''),
      'doc_typ',            v_link.dokument_typ,
      'doc_typ_label',      v_doc_typ_label,
      'doc_typ_label_def',  v_doc_typ_label_def,
      'titel',              COALESCE(v_doc_titel, ''),
      'datum',              v_datum,
      'ip',                 COALESCE(v_ip::text, '—'),
      'pdf_lank',           COALESCE(p_pdf_url, ''),
      'pdf_button',         v_pdf_button,
      'pdf_admin_line',     v_pdf_admin_line,
      'alias_signatur',     ''
    );

    -- Customer confirmation
    IF v_kund_email IS NOT NULL AND length(v_kund_email) > 0 THEN
      SELECT * INTO v_mall_kund
        FROM epost_mallar
       WHERE system_kod = 'signatur_bekraftelse_kund' AND aktiv
       LIMIT 1;

      IF v_mall_kund IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_kund.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_kund.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_kund.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_kund.kropp_html, v_vars);
      ELSE
        v_use_alias := v_alias_id;
        v_amne := format('Bekräftelse: signerad %s %s', v_doc_typ_label, COALESCE(v_doc_nummer, ''));
        v_kropp := format(
          '<p>Hej %s,</p><p>Tack! Din signering av %s %s har registrerats kl %s.</p>%s<p>Med vänlig hälsning,<br>%s</p>',
          COALESCE(v_kund_namn, trim(p_namn)),
          v_doc_typ_label_def, COALESCE(v_doc_nummer, ''),
          v_datum, v_pdf_button, COALESCE(v_foretag_namn, '')
        );
      END IF;

      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_use_alias, v_kund_email, v_amne, v_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;

    -- Admin notification
    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = 'signatur_bekraftelse_admin' AND aktiv
       LIMIT 1;

      IF v_mall_admin IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);
      ELSE
        v_use_alias := v_alias_id;
        v_amne := format('Kund signerade %s %s', v_doc_typ_label, COALESCE(v_doc_nummer, ''));
        v_kropp := format(
          '<p>%s (%s) signerade %s %s — %s.</p><p>Tid: %s · IP: %s</p>%s',
          trim(p_namn), COALESCE(v_kund_email, '—'),
          v_doc_typ_label_def, COALESCE(v_doc_nummer, ''),
          COALESCE(v_doc_titel, ''),
          v_datum, COALESCE(v_ip::text, '—'),
          v_pdf_admin_line
        );
      END IF;

      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_use_alias, v_foretag_email, v_amne, v_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$$;

REVOKE ALL ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ── Patch delete_signing_link to clear signature on ata too ───────────────

CREATE OR REPLACE FUNCTION delete_signing_link(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_projekt_id  UUID;
  v_neg_exists  BOOLEAN;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_link.signerad_at IS NOT NULL THEN
    IF v_link.dokument_typ = 'forslag' THEN
      UPDATE forslag
         SET status         = 'utkast',
             godkand_av     = NULL,
             godkand_datum  = NULL,
             signatur_data  = NULL
       WHERE id = v_link.dokument_id
       RETURNING projekt_id INTO v_projekt_id;
    ELSIF v_link.dokument_typ = 'order' THEN
      UPDATE ordrar
         SET status         = 'Utkast',
             godkand_av     = NULL,
             godkand_datum  = NULL,
             signatur_data  = NULL
       WHERE id = v_link.dokument_id
       RETURNING projekt_id INTO v_projekt_id;
    ELSIF v_link.dokument_typ = 'ata' THEN
      UPDATE ata
         SET status         = 'Utkast',
             godkand_av     = NULL,
             godkand_datum  = NULL,
             signatur_data  = NULL
       WHERE id = v_link.dokument_id
       RETURNING projekt_id INTO v_projekt_id;
    END IF;

    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Negociacion')
        INTO v_neg_exists;
      IF v_neg_exists THEN
        UPDATE projekt
           SET status = 'Negociacion'
         WHERE id = v_projekt_id
           AND status = 'Acepterat';
      END IF;
    END IF;
  END IF;

  DELETE FROM signatur_lankar WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_signing_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_signing_link(UUID) TO authenticated, service_role;

-- ── Patch get_signing_doc to resolve 'ata' branch ─────────────────────────

CREATE OR REPLACE FUNCTION get_signing_doc(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_status      TEXT;
  v_doc         jsonb;
  v_lines       jsonb;
  v_kund        jsonb;
  v_projekt     jsonb;
  v_foretag     jsonb;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_link.revoked_at IS NOT NULL THEN
    v_status := 'revoked';
  ELSIF v_link.signerad_at IS NOT NULL THEN
    v_status := 'signed';
  ELSIF v_link.gar_ut_at < now() THEN
    v_status := 'expired';
  ELSE
    v_status := 'ok';
    IF v_link.oppnad_at IS NULL THEN
      UPDATE signatur_lankar SET oppnad_at = now() WHERE id = v_link.id;
    END IF;
  END IF;

  IF v_link.dokument_typ = 'forslag' THEN
    SELECT to_jsonb(f) INTO v_doc FROM forslag f WHERE f.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ff.id, 'namn', ff.namn, 'beskrivning', ff.beskrivning, 'sortering', ff.sortering,
        'subfaser', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', sf.id, 'namn', sf.namn, 'beskrivning', sf.beskrivning, 'sortering', sf.sortering,
              'arbete',   COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.skapad_at) FROM forslag_arbetskostnad a WHERE a.subfas_id = sf.id), '[]'::jsonb),
              'material', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.skapad_at) FROM forslag_materialkostnad m WHERE m.subfas_id = sf.id), '[]'::jsonb),
              'underentreprenorer', COALESCE((SELECT jsonb_agg(to_jsonb(ue) ORDER BY ue.skapad_at) FROM forslag_underentreprenorer ue WHERE ue.subfas_id = sf.id), '[]'::jsonb)
            ) ORDER BY sf.sortering, sf.skapad_at)
          FROM forslag_subfaser sf WHERE sf.fas_id = ff.id
        ), '[]'::jsonb)
      ) ORDER BY ff.sortering, ff.skapad_at
    ) INTO v_lines
    FROM forslag_faser ff WHERE ff.forslag_id = v_link.dokument_id;
    v_lines := COALESCE(v_lines, '[]'::jsonb);

    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k WHERE k.id = (v_projekt->>'kund_id')::uuid;
  ELSIF v_link.dokument_typ = 'order' THEN
    SELECT to_jsonb(o) INTO v_doc FROM ordrar o WHERE o.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sortering, r.skapad_at), '[]'::jsonb)
      INTO v_lines FROM order_rader r WHERE r.order_id = v_link.dokument_id;
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k WHERE k.id = (v_doc->>'kund_id')::uuid;
  ELSIF v_link.dokument_typ = 'ata' THEN
    SELECT to_jsonb(a) INTO v_doc FROM ata a WHERE a.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sortering, r.skapad_at), '[]'::jsonb)
      INTO v_lines FROM ata_rader r WHERE r.ata_id = v_link.dokument_id;
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k WHERE k.id = (v_doc->>'kund_id')::uuid;
  ELSIF v_link.dokument_typ = 'fritt' THEN
    SELECT to_jsonb(d) INTO v_doc
      FROM signatur_fritta_dokument d
     WHERE d.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    v_lines := '[]'::jsonb;
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund   FROM kunder k WHERE k.id = (v_projekt->>'kund_id')::uuid;
  END IF;

  SELECT jsonb_build_object(
    'foretag_namn',          a.foretag_namn,
    'foretag_org_nummer',    a.foretag_org_nummer,
    'foretag_adress',        a.foretag_adress,
    'foretag_postnummer',    a.foretag_postnummer,
    'foretag_stad',          a.foretag_stad,
    'foretag_telefon',       a.foretag_telefon,
    'foretag_email',         a.foretag_email,
    'foretag_webbadress',    a.foretag_webbadress,
    'foretag_logo_url',      a.foretag_logo_url,
    'valuta',                a.valuta
  ) INTO v_foretag
  FROM app_installningar a LIMIT 1;

  RETURN jsonb_build_object(
    'status',           v_status,
    'doc_typ',          v_link.dokument_typ,
    'doc',              v_doc,
    'lines',            COALESCE(v_lines, '[]'::jsonb),
    'kund',             v_kund,
    'projekt',          v_projekt,
    'foretag',          v_foretag,
    'gar_ut_at',        v_link.gar_ut_at,
    'signerad_at',      v_link.signerad_at,
    'signerad_namn',    v_link.signerad_namn,
    'document_pdf_url', v_link.document_pdf_url,
    'signed_pdf_url',   v_link.signed_pdf_url
  );
END;
$$;

REVOKE ALL ON FUNCTION get_signing_doc(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signing_doc(TEXT) TO anon, authenticated;
