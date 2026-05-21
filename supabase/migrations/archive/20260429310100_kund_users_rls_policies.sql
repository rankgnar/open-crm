-- ============================================================
-- open-crm-client: read-only RLS policies for the customer portal
--
-- For each table the customer portal reads, we add a
-- `*_client_select` policy gated on `is_kund_user_for(...)` /
-- `current_user_kund_ids()`. Drafts (status='utkast'/'Utkast') are
-- filtered out at the policy level so customers never see admin
-- work-in-progress, even if the app forgets to filter.
--
-- Tables that lacked admin coverage prior to this migration
-- (ordrar, order_rader, signatur_lankar) also receive a
-- `*_admin_all` policy so that the Electron app's service_role
-- keeps working AND future authenticated admin access via
-- is_app_admin() is unblocked.
--
-- Fakturor are NOT covered here: the local fakturor / faktura_rader
-- tables were dropped by 20260426180000 in favor of Fortnox as the
-- system of record. The customer portal will surface invoices via
-- a Fortnox-backed read path in a follow-up migration.
-- ============================================================

-- ----- kunder -------------------------------------------------
-- (RLS already enabled by 20260428120000)
DROP POLICY IF EXISTS kunder_client_select ON public.kunder;
CREATE POLICY kunder_client_select ON public.kunder
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.current_user_kund_ids()));

-- ----- projekt ------------------------------------------------
DROP POLICY IF EXISTS projekt_client_select ON public.projekt;
CREATE POLICY projekt_client_select ON public.projekt
  FOR SELECT
  TO authenticated
  USING (kund_id IN (SELECT public.current_user_kund_ids()));

-- ----- forslag ------------------------------------------------
-- forslag has projekt_id (no direct kund_id); join via projekt.
DROP POLICY IF EXISTS forslag_client_select ON public.forslag;
CREATE POLICY forslag_client_select ON public.forslag
  FOR SELECT
  TO authenticated
  USING (
    status <> 'utkast'
    AND projekt_id IN (
      SELECT id FROM public.projekt
       WHERE kund_id IN (SELECT public.current_user_kund_ids())
    )
  );

-- ----- ordrar -------------------------------------------------
ALTER TABLE public.ordrar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ordrar_admin_all ON public.ordrar;
CREATE POLICY ordrar_admin_all ON public.ordrar
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS ordrar_client_select ON public.ordrar;
CREATE POLICY ordrar_client_select ON public.ordrar
  FOR SELECT
  TO authenticated
  USING (
    status <> 'Utkast'
    AND kund_id IN (SELECT public.current_user_kund_ids())
  );

ALTER TABLE public.order_rader ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_rader_admin_all ON public.order_rader;
CREATE POLICY order_rader_admin_all ON public.order_rader
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- order_rader has no direct kund_id; join via ordrar.
DROP POLICY IF EXISTS order_rader_client_select ON public.order_rader;
CREATE POLICY order_rader_client_select ON public.order_rader
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.ordrar
       WHERE status <> 'Utkast'
         AND kund_id IN (SELECT public.current_user_kund_ids())
    )
  );

-- ----- ata + ata_rader ----------------------------------------
-- (RLS + admin_all already in place from 20260428120000)
DROP POLICY IF EXISTS ata_client_select ON public.ata;
CREATE POLICY ata_client_select ON public.ata
  FOR SELECT
  TO authenticated
  USING (
    status <> 'Utkast'
    AND kund_id IN (SELECT public.current_user_kund_ids())
  );

DROP POLICY IF EXISTS ata_rader_client_select ON public.ata_rader;
CREATE POLICY ata_rader_client_select ON public.ata_rader
  FOR SELECT
  TO authenticated
  USING (
    ata_id IN (
      SELECT id FROM public.ata
       WHERE status <> 'Utkast'
         AND kund_id IN (SELECT public.current_user_kund_ids())
    )
  );

-- ----- fakturor / faktura_rader -------------------------------
-- Skipped: the local mirror was dropped (see 20260426180000_drop_fakturor_local).
-- Fortnox is the system of record. Customer portal will read invoices
-- via a dedicated read path in a follow-up.

-- ----- projekt_dokument ---------------------------------------
-- (RLS + admin_all already in place; admin migration line 136-140)
DROP POLICY IF EXISTS projekt_dokument_client_select ON public.projekt_dokument;
CREATE POLICY projekt_dokument_client_select ON public.projekt_dokument
  FOR SELECT
  TO authenticated
  USING (
    projekt_id IN (
      SELECT id FROM public.projekt
       WHERE kund_id IN (SELECT public.current_user_kund_ids())
    )
  );

-- ----- signatur_lankar ----------------------------------------
-- RLS enabled by 20260427001300_signatur_rls but with NO policies.
-- Adding admin_all (for future authenticated admin reads) and
-- client_select (only signed records, with PDF URLs).
DROP POLICY IF EXISTS signatur_lankar_admin_all ON public.signatur_lankar;
CREATE POLICY signatur_lankar_admin_all ON public.signatur_lankar
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS signatur_lankar_client_select ON public.signatur_lankar;
CREATE POLICY signatur_lankar_client_select ON public.signatur_lankar
  FOR SELECT
  TO authenticated
  USING (
    signerad_at IS NOT NULL
    AND kund_id IN (SELECT public.current_user_kund_ids())
  );
