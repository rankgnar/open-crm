-- Two related changes that ship together:
--
-- 1. Protect status names the codebase depends on. There's nothing
--    stopping an admin from renaming "Skickat" to something else or
--    deleting "Acepterat" from Inställningar — and the moment they do,
--    submit_signature() and friends silently stop bumping projekt
--    statuses. Adding an `inbyggd boolean` flag plus a couple of
--    triggers makes those rows un-renamable and un-deletable while
--    leaving farg/sortering / brand-new custom statuses fully editable.
--
-- 2. Wire projekt.status into the signing flow:
--      * sending a forslag/fritt for signature → projekt becomes Skickat
--        (only when projekt is in an early state — never downgrades
--        Acepterat/Aktiv/Klar/Avbruten/Pausad).
--      * customer signs a fritt dokument → projekt becomes Acepterat
--        (the forslag branch already does this; this just adds the
--        equivalent for fritt).
--    Both behind the existing "if the status name actually exists"
--    guards so installs that have customised their pipeline still work.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. inbyggd flag + protective triggers
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE kund_statusar    ADD COLUMN IF NOT EXISTS inbyggd BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projekt_statusar ADD COLUMN IF NOT EXISTS inbyggd BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE forslag_statusar ADD COLUMN IF NOT EXISTS inbyggd BOOLEAN NOT NULL DEFAULT FALSE;

-- Re-insert the names the codebase relies on if the admin already deleted
-- one. Idempotent: only inserts when the row is missing. The
-- `inbyggd=true` makes them safe afterwards.

INSERT INTO kund_statusar (namn, farg, sortering, inbyggd)
SELECT * FROM (VALUES
  ('Ny Kund', 'blue',    0, true),
  ('Aktiv',   'emerald', 1, true),
  ('Inaktiv', 'muted',   2, true)
) AS s(namn, farg, sortering, inbyggd)
WHERE NOT EXISTS (SELECT 1 FROM kund_statusar k WHERE k.namn = s.namn);

UPDATE kund_statusar SET inbyggd = true WHERE namn IN ('Ny Kund', 'Aktiv', 'Inaktiv');

INSERT INTO projekt_statusar (namn, farg, sortering, inbyggd)
SELECT * FROM (VALUES
  ('Skickat',     'blue',    10, true),
  ('Negociacion', 'amber',   20, true),
  ('Acepterat',   'emerald', 30, true),
  ('Aktiv',       'emerald', 40, true),
  ('Klar',        'muted',   50, true)
) AS s(namn, farg, sortering, inbyggd)
ON CONFLICT (namn) DO NOTHING;

UPDATE projekt_statusar SET inbyggd = true
 WHERE namn IN ('Skickat', 'Negociacion', 'Acepterat', 'Aktiv', 'Klar');

INSERT INTO forslag_statusar (namn, farg, sortering, inbyggd)
SELECT * FROM (VALUES
  ('Utkast',         'muted',   0,  true),
  ('Skickat',        'blue',    10, true),
  ('Ändring begärd', 'amber',   20, true),
  ('Accepterat',     'emerald', 30, true),
  ('Avvisat',        'red',     40, true)
) AS s(namn, farg, sortering, inbyggd)
WHERE NOT EXISTS (SELECT 1 FROM forslag_statusar f WHERE f.namn = s.namn);

UPDATE forslag_statusar SET inbyggd = true
 WHERE namn IN ('Utkast', 'Skickat', 'Ändring begärd', 'Accepterat', 'Avvisat');

-- Triggers: refuse rename or delete on inbyggd rows. Farg and sortering
-- stay fully editable so admins can still re-style their pipeline.

CREATE OR REPLACE FUNCTION protect_inbyggd_statusar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.inbyggd IS TRUE THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte tas bort.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.inbyggd IS TRUE AND NEW.namn IS DISTINCT FROM OLD.namn THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte byta namn.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    -- Don't let admins flip inbyggd off either — that would defeat the lock.
    IF OLD.inbyggd IS TRUE AND NEW.inbyggd IS FALSE THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte avmarkeras.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS protect_inbyggd_kund_statusar    ON kund_statusar;
DROP TRIGGER IF EXISTS protect_inbyggd_projekt_statusar ON projekt_statusar;
DROP TRIGGER IF EXISTS protect_inbyggd_forslag_statusar ON forslag_statusar;

CREATE TRIGGER protect_inbyggd_kund_statusar
  BEFORE UPDATE OR DELETE ON kund_statusar
  FOR EACH ROW EXECUTE FUNCTION protect_inbyggd_statusar();

CREATE TRIGGER protect_inbyggd_projekt_statusar
  BEFORE UPDATE OR DELETE ON projekt_statusar
  FOR EACH ROW EXECUTE FUNCTION protect_inbyggd_statusar();

CREATE TRIGGER protect_inbyggd_forslag_statusar
  BEFORE UPDATE OR DELETE ON forslag_statusar
  FOR EACH ROW EXECUTE FUNCTION protect_inbyggd_statusar();

-- ──────────────────────────────────────────────────────────────────────────
-- 2. submit_signature: also bump projekt to Acepterat for fritt dokument
-- ──────────────────────────────────────────────────────────────────────────

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
  v_auto_invite       BOOLEAN;
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

    -- Same projekt promotion as forslag: a fritt dokument signed via
    -- Signera is typically an offer that closed outside the CRM, so
    -- moving the projekt to Acepterat keeps the pipeline coherent.
    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
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

REVOKE ALL ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
