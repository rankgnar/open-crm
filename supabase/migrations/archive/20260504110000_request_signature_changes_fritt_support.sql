-- Extend the customer change-request flow to fritt dokument.
--
-- Until now request_signature_changes() refused anything other than
-- dokument_typ='forslag' (see 20260430100000_signatur_andring_begard.sql),
-- so a customer signing a free-form PDF via Signera could only sign or
-- ignore — they couldn't ask for a revision the way they can on a
-- proper offer. This blocks the import-old-offer use case where the
-- offer text is already in the PDF and the customer might still want
-- a tweak before signing.
--
-- Changes:
--   1. request_signature_changes() now accepts 'fritt'. It reads the
--      title from signatur_fritta_dokument, leaves doc_nummer empty,
--      does NOT touch any document status (no status column on fritta),
--      and falls back to a generic 'signatur_andring_begard_admin_dokument'
--      template if the type-specific one isn't found.
--   2. Seed the generic admin email template, written so it works for
--      any non-forslag doc (no "offert" wording).
--
-- Order/ATA stay sign-or-do-nothing (the user hasn't asked for them).

BEGIN;

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
  v_link            signatur_lankar%ROWTYPE;
  v_reason          TEXT;
  v_xff             TEXT;
  v_ip              INET;
  v_log_aktiv       BOOLEAN;
  v_kund_namn       TEXT;
  v_doc_titel       TEXT;
  v_doc_nummer      TEXT;
  v_projekt_id      UUID;
  v_foretag_email   TEXT;
  v_alias_id        UUID;
  v_alias_signatur  TEXT := '';
  v_mall_admin      RECORD;
  v_use_alias       UUID;
  v_amne            TEXT;
  v_kropp           TEXT;
  v_vars            jsonb;
  v_datum           TEXT;
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
  IF v_link.dokument_typ NOT IN ('forslag', 'fritt') THEN
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

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'Ändring begärd'
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSE
    -- 'fritt' — no status column, just look up the title for the audit trail.
    SELECT projekt_id, titel, NULL::text
      INTO v_projekt_id, v_doc_titel, v_doc_nummer
      FROM signatur_fritta_dokument
     WHERE id = v_link.dokument_id;
  END IF;

  -- Audit trail: anteckning + admin email, mirroring submit_signature.
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
          E'Kund begärde ändring på %s %s\n%s\n\n%s',
          CASE v_link.dokument_typ WHEN 'forslag' THEN 'offert' ELSE 'dokument' END,
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
      -- Try the type-specific template first, then fall back to a generic one
      -- so 'fritt' works even on installations that haven't customised it.
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = 'signatur_andring_begard_admin_' ||
                          CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END
         AND aktiv
       LIMIT 1;
      IF v_mall_admin IS NULL AND v_link.dokument_typ <> 'forslag' THEN
        SELECT * INTO v_mall_admin
          FROM epost_mallar
         WHERE system_kod = 'signatur_andring_begard_admin_dokument' AND aktiv
         LIMIT 1;
      END IF;

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

  RETURN jsonb_build_object('status', 'received');
END;
$$;

REVOKE ALL ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_signature_changes(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Generic admin notification template used for any non-forslag dokument.
-- Sortering 14 sits next to the existing 'signatur_andring_begard_admin_forslag'
-- entry. Wording avoids "offert"/"forslag_nummer" so it works for fritt and
-- any future doc type.
INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
SELECT
  'signatur_andring_begard_admin_dokument',
  'Dokument — Notifikation till admin (ändring begärd)',
  'Signering',
  'Kund begärde ändring på dokument {{titel}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#f59e0b 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#f59e0b;margin:0 0 6px;font-weight:600">Kund begärde ändring</p>
  <p style="font-size:14px;color:#1a1a1a;margin:0 0 16px"><strong>{{kund_namn}}</strong> &lt;{{kund_email}}&gt; vill att dokumentet <strong>{{titel}}</strong> revideras innan signering.</p>
  <div style="background:#fff7ed;border:1px solid #fcd9a4;border-radius:8px;padding:16px 20px;margin:14px 0;color:#7c2d12;font-size:14px;white-space:pre-wrap;line-height:1.55">{{anledning}}</div>
  <p style="font-size:13px;color:#666;margin:18px 0 6px">Tidpunkt: {{datum}}</p>
  <p style="font-size:13px;color:#666;margin:0">Logga in i CRM:et, ladda upp en uppdaterad version och skicka en ny signaturlänk till kunden.</p>
</div>$mall$,
  14,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_andring_begard_admin_dokument'
);

COMMIT;
