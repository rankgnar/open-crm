-- Persist a chronological log of admin-side resends after a change-request.
-- Together with andring_historik (customer-submitted requests) this gives the
-- timeline a complete audit trail of every back-and-forth on a signing link,
-- visible even after the active andring_begard_at flag has been cleared.

BEGIN;

ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS revisioner_historik JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- clear_change_request — also append a {at} entry to revisioner_historik so
-- the timeline can render "Skickat uppdaterad version" events permanently.
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_change_request(p_link_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link signatur_lankar%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

  UPDATE signatur_lankar
     SET andring_begard_at  = NULL,
         revisioner_historik = revisioner_historik
                               || jsonb_build_array(jsonb_build_object('at', now()))
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag SET status = 'Skickat' WHERE id = v_link.dokument_id;
  END IF;

  RETURN jsonb_build_object('status', 'cleared');
END;
$$;

REVOKE ALL ON FUNCTION clear_change_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_change_request(UUID) TO authenticated;

-- ============================================================================
-- get_signing_doc — expose revisioner_historik alongside andring_historik.
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
    'andring_begard_at',      v_link.andring_begard_at,
    'andring_historik',       v_link.andring_historik,
    'revisioner_historik',    v_link.revisioner_historik,
    'document_pdf_url',       v_link.document_pdf_url,
    'signed_pdf_url',         v_link.signed_pdf_url
  );
END;
$$;

REVOKE ALL ON FUNCTION get_signing_doc(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signing_doc(TEXT) TO anon, authenticated;

COMMIT;
