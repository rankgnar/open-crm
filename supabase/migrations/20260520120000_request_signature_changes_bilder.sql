BEGIN;

-- ============================================================================
-- request_signature_changes — add p_bilder_urls TEXT[] parameter so the
-- signing portal can attach image URLs to change requests. URLs are stored
-- in andring_historik alongside the text reason and forwarded to the admin
-- notification email as clickable thumbnails via {{bilder_block}}.
-- ============================================================================

CREATE OR REPLACE FUNCTION request_signature_changes(
  p_token       TEXT,
  p_reason      TEXT,
  p_ua          TEXT,
  p_bilder_urls TEXT[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link           signatur_lankar%ROWTYPE;
  v_reason         TEXT;
  v_xff            TEXT;
  v_ip             INET;
  v_log_aktiv      BOOLEAN;
  v_kund_namn      TEXT;
  v_doc_titel      TEXT;
  v_doc_nummer     TEXT;
  v_projekt_id     UUID;
  v_foretag_email  TEXT;
  v_alias_id       UUID;
  v_alias_signatur TEXT := '';
  v_mall_admin     RECORD;
  v_use_alias      UUID;
  v_amne           TEXT;
  v_kropp          TEXT;
  v_vars           jsonb;
  v_datum          TEXT;
  v_bilder_block   TEXT;
  v_url            TEXT;
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
                                  'ua',     p_ua,
                                  'bilder', to_jsonb(COALESCE(p_bilder_urls, '{}'))
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

    -- Build image block for admin email: small clickable thumbnails or empty string
    v_bilder_block := '';
    IF p_bilder_urls IS NOT NULL AND array_length(p_bilder_urls, 1) > 0 THEN
      v_bilder_block := '<div style="margin:14px 0 0;display:flex;flex-wrap:wrap;gap:8px">';
      FOREACH v_url IN ARRAY p_bilder_urls LOOP
        v_bilder_block := v_bilder_block
          || format(
               '<a href="%s" target="_blank" rel="noreferrer" style="display:block"><img src="%s" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e5e5e5"></a>',
               v_url, v_url
             );
      END LOOP;
      v_bilder_block := v_bilder_block || '</div>';
    END IF;

    v_vars := jsonb_build_object(
      'kund_namn',      COALESCE(v_kund_namn, '—'),
      'kund_email',     COALESCE(v_link.kund_email, '—'),
      'doc_nummer',     COALESCE(v_doc_nummer, ''),
      'titel',          COALESCE(v_doc_titel, ''),
      'datum',          v_datum,
      'anledning',      v_reason,
      'bilder_block',   v_bilder_block,
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

-- Revoke old 3-param signature and grant new 4-param signature
REVOKE ALL ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;

-- Add {{bilder_block}} to the admin notification email template after the
-- anledning amber block so image thumbnails appear in the notification.
UPDATE epost_mallar
SET kropp_html = replace(
  kropp_html,
  '<p style="font-size:13px;color:#666;margin:18px 0 6px">Tidpunkt',
  '{{bilder_block}}<p style="font-size:13px;color:#666;margin:18px 0 6px">Tidpunkt'
)
WHERE system_kod = 'signatur_andring_begard_admin_forslag'
  AND kropp_html NOT LIKE '%{{bilder_block}}%';

COMMIT;
