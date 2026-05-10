-- Deleting a signed link must also remove the signature from the source
-- document — otherwise the förslag/order keeps godkand_av / signatur_data and
-- the UI shows "Signerad utanför signaturlänk-systemet" with a ghost approval.
--
-- Behaviour:
--  · forslag → status='utkast', clear godkand_av/godkand_datum/signatur_data
--  · order   → status='Utkast', same clear
--  · fritt   → only the link row is deleted (no signature columns of its own)
--  · projekt → if it sits in 'Acepterat' (set by submit_signature) and the
--              user-managed status 'Negociacion' exists, roll it back there.
--              Project anteckningar created at sign-time are kept as audit.

CREATE OR REPLACE FUNCTION delete_signing_link(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_projekt_id  UUID;
  v_neg_exists  BOOLEAN;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_link.signerad_at IS NOT NULL THEN
    IF v_link.dokument_typ = 'forslag' THEN
      UPDATE forslag
         SET status         = 'utkast',
             godkand_av     = NULL,
             godkand_datum  = NULL,
             signatur_data  = NULL
       WHERE id = v_link.dokument_id
       RETURNING projekt_id INTO v_projekt_id;
    ELSIF v_link.dokument_typ = 'order' THEN
      UPDATE ordrar
         SET status         = 'Utkast',
             godkand_av     = NULL,
             godkand_datum  = NULL,
             signatur_data  = NULL
       WHERE id = v_link.dokument_id
       RETURNING projekt_id INTO v_projekt_id;
    END IF;

    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Negociacion')
        INTO v_neg_exists;
      IF v_neg_exists THEN
        UPDATE projekt
           SET status = 'Negociacion'
         WHERE id = v_projekt_id
           AND status = 'Acepterat';
      END IF;
    END IF;
  END IF;

  DELETE FROM signatur_lankar WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_signing_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_signing_link(UUID) TO authenticated, service_role;
