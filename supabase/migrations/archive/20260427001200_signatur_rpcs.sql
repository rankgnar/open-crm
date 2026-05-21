-- ============================================================
-- Public signing RPCs (SECURITY DEFINER so anon can invoke without
-- direct table access). All access to signatur_lankar from public
-- traffic goes through these.
-- ============================================================

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
  -- Fetch link by token
  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Determine current status
  IF v_link.revoked_at IS NOT NULL THEN
    v_status := 'revoked';
  ELSIF v_link.signerad_at IS NOT NULL THEN
    v_status := 'signed';
  ELSIF v_link.gar_ut_at < now() THEN
    v_status := 'expired';
  ELSE
    v_status := 'ok';
    -- Mark first open
    IF v_link.oppnad_at IS NULL THEN
      UPDATE signatur_lankar SET oppnad_at = now() WHERE id = v_link.id;
    END IF;
  END IF;

  -- Fetch the underlying document
  IF v_link.dokument_typ = 'forslag' THEN
    SELECT to_jsonb(f) INTO v_doc FROM forslag f WHERE f.id = v_link.dokument_id;
    IF v_doc IS NULL THEN
      RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- Hierarchical lines: faser → arbete + material + subkontraktorer
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',          ff.id,
        'namn',        ff.namn,
        'beskrivning', ff.beskrivning,
        'sortering',   ff.sortering,
        'arbete',      COALESCE((
          SELECT jsonb_agg(to_jsonb(a) ORDER BY a.skapad_at)
          FROM forslag_arbetskostnad a WHERE a.fas_id = ff.id
        ), '[]'::jsonb),
        'material',    COALESCE((
          SELECT jsonb_agg(to_jsonb(m) ORDER BY m.skapad_at)
          FROM forslag_materialkostnad m WHERE m.fas_id = ff.id
        ), '[]'::jsonb)
      ) ORDER BY ff.sortering, ff.skapad_at
    ) INTO v_lines
    FROM forslag_faser ff WHERE ff.forslag_id = v_link.dokument_id;
    v_lines := COALESCE(v_lines, '[]'::jsonb);

    -- Project + customer via projekt
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p
    WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k
    WHERE k.id = (v_projekt->>'kund_id')::uuid;

  ELSIF v_link.dokument_typ = 'order' THEN
    SELECT to_jsonb(o) INTO v_doc FROM ordrar o WHERE o.id = v_link.dokument_id;
    IF v_doc IS NULL THEN
      RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- Flat rader
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sortering, r.skapad_at), '[]'::jsonb)
    INTO v_lines
    FROM order_rader r WHERE r.order_id = v_link.dokument_id;

    -- Project + customer
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p
    WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k
    WHERE k.id = (v_doc->>'kund_id')::uuid;
  END IF;

  -- Foretag info (single row table)
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
    'status',       v_status,
    'doc_typ',      v_link.dokument_typ,
    'doc',          v_doc,
    'lines',        COALESCE(v_lines, '[]'::jsonb),
    'kund',         v_kund,
    'projekt',      v_projekt,
    'foretag',      v_foretag,
    'gar_ut_at',    v_link.gar_ut_at,
    'signerad_at',  v_link.signerad_at,
    'signerad_namn',v_link.signerad_namn
  );
END;
$$;

REVOKE ALL ON FUNCTION get_signing_doc(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signing_doc(TEXT) TO anon, authenticated;


-- ============================================================
-- submit_signature: atomic write across signatur_lankar + the underlying
-- doc + projekt_anteckningar + epost_ko (when toggle is active).
-- ============================================================

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
BEGIN
  IF p_token IS NULL OR p_namn IS NULL OR length(trim(p_namn)) = 0 OR p_signatur IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Lock the row to avoid races
  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

  -- Capture IP from headers (Supabase-injected)
  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  -- Mark the link as signed
  UPDATE signatur_lankar
     SET signerad_at = now(),
         signerad_namn = trim(p_namn),
         signerad_ip = v_ip,
         signerad_ua = p_ua,
         signatur_data = p_signatur
   WHERE id = v_link.id;

  -- Update the underlying document
  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'accepterat',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
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

  -- Read toggle + foretag info for the optional auto-actions
  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    -- Lookup customer + company
    SELECT k.namn, k.email INTO v_kund_namn, v_kund_email
      FROM kunder k WHERE k.id = v_link.kund_id;
    IF v_kund_email IS NULL THEN v_kund_email := v_link.kund_email; END IF;

    SELECT a.foretag_namn, a.foretag_email INTO v_foretag_namn, v_foretag_email
      FROM app_installningar a LIMIT 1;

    -- 1) Anteckning in the project feed
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

    -- Default "signatur" alias (first one if any)
    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    -- 2) Email to client (confirmation)
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

    -- 3) Email to admin (notification)
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


-- Admin-side helper, callable via service_role only (no GRANT to anon)
CREATE OR REPLACE FUNCTION revoke_signing_link(p_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE signatur_lankar SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
$$;
