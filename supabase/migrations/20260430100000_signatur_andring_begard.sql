-- Customer change-request flow on signing links.
--
-- When a customer reviews a förslag via the signing portal they can now
-- request changes instead of signing. The request is stored on the link
-- (as a JSONB history + last-request timestamp) and the förslag status
-- moves to 'Ändring begärd'. The admin sees the request in the CRM, edits
-- the förslag, and resends the same link with an updated PDF.
--
-- Scope: dokument_typ='forslag' only. Order/ATA/fritt keep the current
-- sign-or-do-nothing flow.

BEGIN;

ALTER TABLE signatur_lankar
  ADD COLUMN IF NOT EXISTS andring_begard_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS andring_historik  JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO forslag_statusar (namn, farg, sortering)
VALUES ('Ändring begärd', 'amber', 25)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- request_signature_changes — public RPC called by the signing portal.
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

  -- Audit trail mirroring submit_signature: anteckning + admin email.
  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;
    SELECT a.foretag_email INTO v_foretag_email FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, innehall)
      VALUES (
        v_projekt_id,
        format(
          E'Kund begärde ändring på offert %s\n%s\n\n%s',
          COALESCE(v_doc_nummer, v_doc_titel, ''),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
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
-- clear_change_request — admin-only RPC. Called by the CRM after the admin
-- has edited the förslag and is about to resend the link to the customer.
-- Resets andring_begard_at (history is preserved) and bumps förslag back to
-- 'Skickat' so the customer sees a clean ready-to-sign state on return.
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
     SET andring_begard_at = NULL
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
-- get_signing_doc — expose the new fields so the portal can render the
-- "Tidigare begäran" banner and disable signing while a request is pending.
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
    'document_pdf_url',       v_link.document_pdf_url,
    'signed_pdf_url',         v_link.signed_pdf_url
  );
END;
$$;

REVOKE ALL ON FUNCTION get_signing_doc(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signing_doc(TEXT) TO anon, authenticated;

-- ============================================================================
-- Email template seed: admin notification when a customer requests changes.
-- Sortering 13 sits between the existing notifikation_admin entries (12) and
-- the next category. Visual style matches signatur_notifikation_admin_forslag.
-- ============================================================================

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
SELECT
  'signatur_andring_begard_admin_forslag',
  'Förslag — Notifikation till admin (ändring begärd)',
  'Förslag',
  'Kund begärde ändring på offert {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#f59e0b 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#f59e0b;margin:0 0 6px;font-weight:600">Kund begärde ändring</p>
  <p style="font-size:14px;color:#1a1a1a;margin:0 0 16px"><strong>{{kund_namn}}</strong> &lt;{{kund_email}}&gt; vill att offerten <strong>{{doc_nummer}}</strong> revideras innan signering.</p>
  <div style="background:#fff7ed;border:1px solid #fcd9a4;border-radius:8px;padding:16px 20px;margin:14px 0;color:#7c2d12;font-size:14px;white-space:pre-wrap;line-height:1.55">{{anledning}}</div>
  <p style="font-size:13px;color:#666;margin:18px 0 6px">Tidpunkt: {{datum}}</p>
  <p style="font-size:13px;color:#666;margin:0">Logga in i CRM:et, gör ändringarna i offerten och tryck på <strong>Skicka uppdaterad version</strong> på offerten.</p>
</div>$mall$,
  13,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_andring_begard_admin_forslag'
);

COMMIT;
