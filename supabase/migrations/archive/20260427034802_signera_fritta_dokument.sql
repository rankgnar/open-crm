-- Signera (free-form signing): allow uploading any document, send to a
-- customer to sign, then archive the signed copy into the project's
-- DocumentPanel.
--
-- Reuses the existing signatur_lankar / submit_signature pipeline by adding
-- a third dokument_typ value: 'fritt'. The dokument_id then references the
-- new signatur_fritta_dokument table (file metadata + project FK).

-- 1. Extend the dokument_typ check.
ALTER TABLE signatur_lankar
  DROP CONSTRAINT IF EXISTS signatur_lankar_dokument_typ_check;
ALTER TABLE signatur_lankar
  ADD CONSTRAINT signatur_lankar_dokument_typ_check
  CHECK (dokument_typ IN ('forslag', 'order', 'fritt'));

-- 2. New table for the uploaded original.
CREATE TABLE IF NOT EXISTS signatur_fritta_dokument (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id            UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  titel                 TEXT NOT NULL,
  filnamn               TEXT NOT NULL,
  mime_type             TEXT NOT NULL,
  storlek               BIGINT NOT NULL,
  storage_path          TEXT NOT NULL,                            -- path in signing-pdfs bucket: {token}/document.pdf
  arkiverad_dokument_id UUID REFERENCES projekt_dokument(id) ON DELETE SET NULL,
  arkiverad_at          TIMESTAMPTZ,
  skapad_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatur_fritta_dokument_projekt
  ON signatur_fritta_dokument(projekt_id);

-- 3. Patch submit_signature to handle 'fritt' (no doc-table to update; we
--    still log a projekt_anteckning + queue customer/admin emails).
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
  ELSE
    -- 'fritt': no source doc to update. Resolve projekt + titel from the
    -- uploaded original metadata.
    SELECT projekt_id, titel, NULL::text
      INTO v_projekt_id, v_doc_titel, v_doc_nummer
      FROM signatur_fritta_dokument
     WHERE id = v_link.dokument_id;
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
        format('Signerad %s — %s',
               v_link.dokument_typ,
               COALESCE(v_doc_nummer, v_doc_titel, '')),
        format(
          E'Signerad av %s\n%s\nIP: %s',
          trim(p_namn),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—')
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    v_doc_typ_label     := CASE
                             WHEN v_link.dokument_typ = 'forslag' THEN 'offert'
                             WHEN v_link.dokument_typ = 'order'   THEN 'order'
                             ELSE 'dokument'
                           END;
    v_doc_typ_label_def := CASE
                             WHEN v_link.dokument_typ = 'forslag' THEN 'offerten'
                             WHEN v_link.dokument_typ = 'order'   THEN 'ordern'
                             ELSE 'dokumentet'
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
        v_amne := format('Bekräftelse: signerad %s %s', v_doc_typ_label, COALESCE(v_doc_nummer, v_doc_titel, ''));
        v_kropp := format(
          '<p>Hej %s,</p><p>Tack! Din signering av %s %s har registrerats kl %s.</p>%s<p>Med vänlig hälsning,<br>%s</p>',
          COALESCE(v_kund_namn, trim(p_namn)),
          v_doc_typ_label_def, COALESCE(v_doc_nummer, v_doc_titel, ''),
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
        v_amne := format('Kund signerade %s %s', v_doc_typ_label, COALESCE(v_doc_nummer, v_doc_titel, ''));
        v_kropp := format(
          '<p>%s (%s) signerade %s %s — %s.</p><p>Tid: %s · IP: %s</p>%s',
          trim(p_namn), COALESCE(v_kund_email, '—'),
          v_doc_typ_label_def, COALESCE(v_doc_nummer, v_doc_titel, ''),
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
