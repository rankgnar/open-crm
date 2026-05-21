-- After a customer signs a forslag, also bump the parent projekt to
-- 'Acepterat' so it shows green in the projekt list. Defensive: only
-- updates if such a status name actually exists in the projekt_statusar
-- catalog. Order signings do not auto-bump (orders are usually subordinate).

CREATE OR REPLACE FUNCTION submit_signature(
  p_token   TEXT,
  p_namn    TEXT,
  p_signatur TEXT,
  p_ua      TEXT
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
  v_admin_amne        TEXT;
  v_kund_amne         TEXT;
  v_admin_kropp       TEXT;
  v_kund_kropp        TEXT;
  v_alias_id          UUID;
  v_acepterat_exists  BOOLEAN;
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
         signatur_data = p_signatur
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

    -- Bump the parent project to 'Acepterat' if that status exists.
    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
      END IF;
    END IF;
  ELSE
    UPDATE ordrar
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, order_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn, k.email INTO v_kund_namn, v_kund_email
      FROM kunder k WHERE k.id = v_link.kund_id;
    IF v_kund_email IS NULL THEN v_kund_email := v_link.kund_email; END IF;

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

    IF v_kund_email IS NOT NULL AND length(v_kund_email) > 0 THEN
      v_kund_amne := format('Bekräftelse: signerad %s %s',
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offert' ELSE 'order' END,
        COALESCE(v_doc_nummer, ''));
      v_kund_kropp := format(
        '<p>Hej %s,</p><p>Tack! Din signering av %s %s har registrerats kl %s.</p><p>Med vänlig hälsning,<br>%s</p>',
        COALESCE(v_kund_namn, trim(p_namn)),
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offerten' ELSE 'ordern' END,
        COALESCE(v_doc_nummer, ''),
        to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
        COALESCE(v_foretag_namn, '')
      );
      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_alias_id, v_kund_email, v_kund_amne, v_kund_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      v_admin_amne := format('Kund signerade %s %s',
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offert' ELSE 'order' END,
        COALESCE(v_doc_nummer, ''));
      v_admin_kropp := format(
        '<p>%s (%s) signerade %s %s — %s.</p><p>Tid: %s · IP: %s</p>',
        trim(p_namn),
        COALESCE(v_kund_email, '—'),
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offerten' ELSE 'ordern' END,
        COALESCE(v_doc_nummer, ''),
        COALESCE(v_doc_titel, ''),
        to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
        COALESCE(v_ip::text, '—')
      );
      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_alias_id, v_foretag_email, v_admin_amne, v_admin_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$$;

REVOKE ALL ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
