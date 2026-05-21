-- The sign portal stamps and uploads signed versions of specifikation and tidplan PDFs,
-- then passes those signed URLs to submit_signature() as p_specifikation_pdf_url /
-- p_tidplan_pdf_url.  Previously the RPC only saved signed_pdf_url (main offert) and
-- discarded the other two — so the CRM kept showing the unsigned pre-signing URLs.
-- Fix: persist the signed URLs back into specifikation_pdf_url / tidplan_pdf_url,
-- using COALESCE so a missing param never overwrites an existing value.

BEGIN;

CREATE OR REPLACE FUNCTION submit_signature(
  p_token                  TEXT,
  p_namn                   TEXT,
  p_signatur               TEXT,
  p_ua                     TEXT,
  p_pdf_url                TEXT DEFAULT NULL,
  p_personnummer           TEXT DEFAULT NULL,
  p_dokument_hash          TEXT DEFAULT NULL,
  p_specifikation_pdf_url  TEXT DEFAULT NULL,
  p_tidplan_pdf_url        TEXT DEFAULT NULL
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
  v_auto_invite       BOOLEAN;
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
  v_signed_pnr_norm   TEXT;
  v_kund_pnr_norm     TEXT;
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
         signed_pdf_url         = p_pdf_url,
         specifikation_pdf_url  = COALESCE(NULLIF(p_specifikation_pdf_url, ''), v_link.specifikation_pdf_url),
         tidplan_pdf_url        = COALESCE(NULLIF(p_tidplan_pdf_url, ''), v_link.tidplan_pdf_url)
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

  -- Sync personnummer to the kund record (or flag a mismatch).
  IF v_link.kund_id IS NOT NULL AND p_personnummer IS NOT NULL THEN
    v_signed_pnr_norm := normalize_personnummer(p_personnummer);
    IF length(v_signed_pnr_norm) >= 10 THEN
      SELECT normalize_personnummer(personnummer) INTO v_kund_pnr_norm
        FROM kunder WHERE id = v_link.kund_id;

      IF v_kund_pnr_norm IS NULL OR length(v_kund_pnr_norm) = 0 THEN
        UPDATE kunder
           SET personnummer = format_personnummer(p_personnummer)
         WHERE id = v_link.kund_id;
      ELSIF right(v_kund_pnr_norm, 10) <> right(v_signed_pnr_norm, 10) THEN
        IF v_projekt_id IS NOT NULL THEN
          INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
          VALUES (
            v_projekt_id,
            'Personnummer-avvikelse vid signering',
            format(
              E'Kunden signerade med personnummer %s, men kundkortet i CRM:et har %s. Verifiera vilken uppgift som är korrekt.',
              format_personnummer(p_personnummer),
              format_personnummer(v_kund_pnr_norm)
            )
          );
        END IF;
      END IF;
    END IF;
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
        '<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner Signerad %s</a></td></tr></tbody></table>',
        p_pdf_url,
        CASE v_link.dokument_typ
          WHEN 'forslag' THEN 'Offert'
          WHEN 'order'   THEN 'Order'
          WHEN 'ata'     THEN 'ÄTA-arbete'
          ELSE 'Dokument'
        END
      );
      v_pdf_admin_line := format('<div style="margin-top:18px;font-size:13px;color:#666"><strong style="color:#1a1a1a">PDF:</strong> <a href="%s" style="color:#5363f2">%s</a></div>', p_pdf_url, p_pdf_url);
    END IF;

    IF p_specifikation_pdf_url IS NOT NULL AND length(p_specifikation_pdf_url) > 0 THEN
      v_pdf_button := v_pdf_button || format(
        '<table cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad Specifikation</a></td></tr></tbody></table>',
        p_specifikation_pdf_url
      );
    END IF;

    IF p_tidplan_pdf_url IS NOT NULL AND length(p_tidplan_pdf_url) > 0 THEN
      v_pdf_button := v_pdf_button || format(
        '<table cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad Tidplan</a></td></tr></tbody></table>',
        p_tidplan_pdf_url
      );
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

      IF FOUND THEN
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

      IF FOUND THEN
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

  -- Portal auto-invite: independent of the email toggle above.
  -- For forslag: respects the kund_portal_auto_invite toggle in app_installningar.
  -- For fritt: respects the per-link auto_invite_kund_portal flag.
  IF v_link.kund_id IS NOT NULL THEN
    IF v_link.dokument_typ = 'forslag' THEN
      SELECT a.kund_portal_auto_invite INTO v_auto_invite
        FROM app_installningar a LIMIT 1;
      IF v_auto_invite IS TRUE THEN
        INSERT INTO kund_portal_invite_queue (kund_id, source_lank_id)
        VALUES (v_link.kund_id, v_link.id);
      END IF;
    ELSIF v_link.dokument_typ = 'fritt' AND v_link.auto_invite_kund_portal IS TRUE THEN
      INSERT INTO kund_portal_invite_queue (kund_id, source_lank_id)
      VALUES (v_link.kund_id, v_link.id);
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$$;

COMMIT;
