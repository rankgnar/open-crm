-- Mirror change-request events into projekt_anteckningar so the project's
-- notes feed shows the same audit trail as the signature timeline:
--   * "Kund begärde ändring" on each customer-submitted request
--   * "Skickat uppdaterad version" on each admin resend
--
-- Both writes are gated on aktivitetslogg_installningar.handelse =
-- 'signatur_inskickad', matching submit_signature.

BEGIN;

-- ============================================================================
-- request_signature_changes — add a titel to the anteckning insert so the
-- project notes panel renders a clear header instead of an empty string.
-- ============================================================================

CREATE OR REPLACE FUNCTION request_signature_changes(
  p_token  TEXT,
  p_reason TEXT,
  p_ua     TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link          signatur_lankar%ROWTYPE;
  v_reason        TEXT;
  v_xff           TEXT;
  v_ip            INET;
  v_log_aktiv     BOOLEAN;
  v_kund_namn     TEXT;
  v_doc_titel     TEXT;
  v_doc_nummer    TEXT;
  v_projekt_id    UUID;
  v_foretag_email TEXT;
  v_alias_id      UUID;
  v_alias_signatur TEXT := '';
  v_mall_admin    RECORD;
  v_use_alias     UUID;
  v_amne          TEXT;
  v_kropp         TEXT;
  v_vars          jsonb;
  v_datum         TEXT;
BEGIN
  IF p_token IS NULL OR p_reason IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  v_reason := trim(p_reason);
  IF length(v_reason) < 5 THEN
    RETURN jsonb_build_object('status', 'invalid_reason');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now()      THEN RETURN jsonb_build_object('status', 'expired'); END IF;
  IF v_link.dokument_typ <> 'forslag' THEN
    RETURN jsonb_build_object('status', 'unsupported_doc_typ');
  END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET andring_begard_at = now(),
         andring_historik  = andring_historik
                             || jsonb_build_array(jsonb_build_object(
                                  'at',     now(),
                                  'reason', v_reason,
                                  'ip',     v_ip::text,
                                  'ua',     p_ua
                                ))
   WHERE id = v_link.id;

  UPDATE forslag
     SET status = 'Ändring begärd'
   WHERE id = v_link.dokument_id
   RETURNING projekt_id, titel, forslag_nummer
     INTO v_projekt_id, v_doc_titel, v_doc_nummer;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;
    SELECT a.foretag_email INTO v_foretag_email FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Kund begärde ändring — offert %s', COALESCE(v_doc_nummer, v_doc_titel, '')),
        format(
          E'%s\nIP: %s\n\n%s',
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—'),
          v_reason
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;
    v_datum := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    v_vars := jsonb_build_object(
      'kund_namn',      COALESCE(v_kund_namn, '—'),
      'kund_email',     COALESCE(v_link.kund_email, '—'),
      'doc_nummer',     COALESCE(v_doc_nummer, ''),
      'titel',          COALESCE(v_doc_titel, ''),
      'datum',          v_datum,
      'anledning',      v_reason,
      'alias_signatur', ''
    );

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = 'signatur_andring_begard_admin_forslag' AND aktiv
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
          v_link.kund_id, v_projekt_id, v_link.dokument_id,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'received');
END;
$$;

REVOKE ALL ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- clear_change_request — also writes a "Skickat uppdaterad version"
-- anteckning on the project notes feed so the resend is visible there too.
-- Gated on the same signatur_inskickad flag as submit_signature.
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_change_request(p_link_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_log_aktiv   BOOLEAN;
  v_doc_nummer  TEXT;
  v_doc_titel   TEXT;
  v_projekt_id  UUID;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

  UPDATE signatur_lankar
     SET andring_begard_at  = NULL,
         revisioner_historik = revisioner_historik
                               || jsonb_build_array(jsonb_build_object('at', now()))
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'Skickat'
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE AND v_projekt_id IS NOT NULL THEN
    INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
    VALUES (
      v_projekt_id,
      format('Skickat uppdaterad version — offert %s', COALESCE(v_doc_nummer, v_doc_titel, '')),
      to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI')
    );
  END IF;

  RETURN jsonb_build_object('status', 'cleared');
END;
$$;

REVOKE ALL ON FUNCTION clear_change_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_change_request(UUID) TO authenticated;

COMMIT;
