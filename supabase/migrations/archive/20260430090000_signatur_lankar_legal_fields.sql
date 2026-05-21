-- Add legal-grade audit fields to digital-signature flow:
--   * signerad_personnummer  — Swedish personal ID provided by signer
--   * signerad_metod         — how the signature was collected (e.g. 'epost_lank')
--   * signerad_dokument_hash — SHA-256 of the document PDF, computed client-side
--                              before stamping; proves PDF integrity at sign time
--
-- The signing portal (open-crm-sign) collects these new fields and prints them
-- on the stamp block of the signed PDF, alongside name + IP + timestamp.

BEGIN;

ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS signerad_personnummer  TEXT,
  ADD COLUMN IF NOT EXISTS signerad_metod         TEXT,
  ADD COLUMN IF NOT EXISTS signerad_dokument_hash TEXT;

-- ============================================================================
-- submit_signature — extended with personnummer + document hash + method.
-- Adding parameters changes the signature, so the previous overload must be
-- dropped explicitly (CREATE OR REPLACE cannot change the parameter list).
-- ============================================================================

DROP FUNCTION IF EXISTS submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION submit_signature(
  p_token         TEXT,
  p_namn          TEXT,
  p_signatur      TEXT,
  p_ua            TEXT,
  p_pdf_url       TEXT DEFAULT NULL,
  p_personnummer  TEXT DEFAULT NULL,
  p_dokument_hash TEXT DEFAULT NULL
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
  v_kod_kund          TEXT;
  v_kod_admin         TEXT;
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
     SET signerad_at            = now(),
         signerad_namn          = trim(p_namn),
         signerad_ip            = v_ip,
         signerad_ua            = p_ua,
         signerad_personnummer  = NULLIF(trim(COALESCE(p_personnummer, '')), ''),
         signerad_metod         = 'epost_lank',
         signerad_dokument_hash = NULLIF(trim(COALESCE(p_dokument_hash, '')), ''),
         signatur_data          = p_signatur,
         signed_pdf_url         = p_pdf_url
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
  ELSIF v_link.dokument_typ = 'fritt' THEN
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

    v_kod_kund  := 'signatur_bekraftelse_kund_'  || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;
    v_kod_admin := 'signatur_notifikation_admin_' || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;

    v_doc_typ_label     := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offert'
                              WHEN 'order'   THEN 'order'
                              WHEN 'ata'     THEN 'ÄTA-arbete'
                              ELSE 'dokument'
                            END;
    v_doc_typ_label_def := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offerten'
                              WHEN 'order'   THEN 'ordern'
                              WHEN 'ata'     THEN 'ÄTA-arbetet'
                              ELSE 'dokumentet'
                            END;
    v_datum             := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    IF p_pdf_url IS NOT NULL AND length(p_pdf_url) > 0 THEN
      v_pdf_button := format(
        '<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad PDF</a></td></tr></tbody></table>',
        p_pdf_url
      );
      v_pdf_admin_line := format('<div style="margin-top:18px;font-size:13px;color:#666"><strong style="color:#1a1a1a">PDF:</strong> <a href="%s" style="color:#5363f2">%s</a></div>', p_pdf_url, p_pdf_url);
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
       WHERE system_kod = v_kod_kund AND aktiv
       LIMIT 1;

      IF v_mall_kund IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_kund.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_kund.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_kund.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_kund.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_kund_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = v_kod_admin AND aktiv
       LIMIT 1;

      IF v_mall_admin IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_foretag_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$$;

REVOKE ALL ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- get_signing_doc — expose new audit fields + the recipient email so the
-- signing portal can render them on the stamp block.
-- ============================================================================

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
  v_xff         TEXT;
  v_request_ip  TEXT;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Resolve the caller's IP from x-forwarded-for so the portal can stamp it
  -- on the PDF before calling submit_signature. submit_signature reads the
  -- same header, so the value embedded in the stamp matches what is stored.
  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_request_ip := split_part(v_xff, ',', 1);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_request_ip := NULL;
  END;

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
    'status',                 v_status,
    'doc_typ',                v_link.dokument_typ,
    'doc',                    v_doc,
    'lines',                  COALESCE(v_lines, '[]'::jsonb),
    'kund',                   v_kund,
    'projekt',                v_projekt,
    'foretag',                v_foretag,
    'gar_ut_at',              v_link.gar_ut_at,
    'kund_email',             v_link.kund_email,
    'request_ip',             v_request_ip,
    'signerad_at',            v_link.signerad_at,
    'signerad_namn',          v_link.signerad_namn,
    'signerad_ip',            v_link.signerad_ip,
    'signerad_personnummer',  v_link.signerad_personnummer,
    'signerad_metod',         v_link.signerad_metod,
    'signerad_dokument_hash', v_link.signerad_dokument_hash,
    'document_pdf_url',       v_link.document_pdf_url,
    'signed_pdf_url',         v_link.signed_pdf_url
  );
END;
$$;

REVOKE ALL ON FUNCTION get_signing_doc(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signing_doc(TEXT) TO anon, authenticated;

COMMIT;
