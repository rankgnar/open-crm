-- Enable RLS on all tables that were left open.
-- Electron main process uses service_role key which bypasses RLS — no impact there.
-- 30 tables: Electron-only access verified via IPC handler audit — block anon/authenticated entirely.
-- 2 tables: also read by PWAs (open-crm-app, open-crm-client) — block write, allow SELECT to authenticated.

-- ============================================================
-- PART A: bloqueo total — 30 tables (Electron-only, service_role)
-- ============================================================

-- ai_asistenter
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_asistenter FROM anon, authenticated;
ALTER TABLE public.ai_asistenter ENABLE ROW LEVEL SECURITY;

-- _applied_migrations
REVOKE SELECT, INSERT, UPDATE, DELETE ON public._applied_migrations FROM anon, authenticated;
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;

-- arbets_roller
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.arbets_roller FROM anon, authenticated;
ALTER TABLE public.arbets_roller ENABLE ROW LEVEL SECURITY;

-- artiklar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.artiklar FROM anon, authenticated;
ALTER TABLE public.artiklar ENABLE ROW LEVEL SECURITY;

-- ekonomi_utfall
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ekonomi_utfall FROM anon, authenticated;
ALTER TABLE public.ekonomi_utfall ENABLE ROW LEVEL SECURITY;

-- epost_alias
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.epost_alias FROM anon, authenticated;
ALTER TABLE public.epost_alias ENABLE ROW LEVEL SECURITY;

-- epost_ko
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.epost_ko FROM anon, authenticated;
ALTER TABLE public.epost_ko ENABLE ROW LEVEL SECURITY;

-- epost_mallar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.epost_mallar FROM anon, authenticated;
ALTER TABLE public.epost_mallar ENABLE ROW LEVEL SECURITY;

-- fakturering_snapshots
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fakturering_snapshots FROM anon, authenticated;
ALTER TABLE public.fakturering_snapshots ENABLE ROW LEVEL SECURITY;

-- fas_mallar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fas_mallar FROM anon, authenticated;
ALTER TABLE public.fas_mallar ENABLE ROW LEVEL SECURITY;

-- fas_mall_faser
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fas_mall_faser FROM anon, authenticated;
ALTER TABLE public.fas_mall_faser ENABLE ROW LEVEL SECURITY;

-- fas_mall_subfaser
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fas_mall_subfaser FROM anon, authenticated;
ALTER TABLE public.fas_mall_subfaser ENABLE ROW LEVEL SECURITY;

-- forslag_epost_refs
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.forslag_epost_refs FROM anon, authenticated;
ALTER TABLE public.forslag_epost_refs ENABLE ROW LEVEL SECURITY;

-- forslag_statusar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.forslag_statusar FROM anon, authenticated;
ALTER TABLE public.forslag_statusar ENABLE ROW LEVEL SECURITY;

-- kalender_event_dokument
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.kalender_event_dokument FROM anon, authenticated;
ALTER TABLE public.kalender_event_dokument ENABLE ROW LEVEL SECURITY;

-- kalendrar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.kalendrar FROM anon, authenticated;
ALTER TABLE public.kalendrar ENABLE ROW LEVEL SECURITY;

-- kund_statusar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.kund_statusar FROM anon, authenticated;
ALTER TABLE public.kund_statusar ENABLE ROW LEVEL SECURITY;

-- leverantorer
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.leverantorer FROM anon, authenticated;
ALTER TABLE public.leverantorer ENABLE ROW LEVEL SECURITY;

-- material_import_config
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.material_import_config FROM anon, authenticated;
ALTER TABLE public.material_import_config ENABLE ROW LEVEL SECURITY;

-- material_katalog
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.material_katalog FROM anon, authenticated;
ALTER TABLE public.material_katalog ENABLE ROW LEVEL SECURITY;

-- pdf_mallar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.pdf_mallar FROM anon, authenticated;
ALTER TABLE public.pdf_mallar ENABLE ROW LEVEL SECURITY;

-- personal_statusar
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.personal_statusar FROM anon, authenticated;
ALTER TABLE public.personal_statusar ENABLE ROW LEVEL SECURITY;

-- projekt_aktiviteter
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.projekt_aktiviteter FROM anon, authenticated;
ALTER TABLE public.projekt_aktiviteter ENABLE ROW LEVEL SECURITY;

-- projekt_context
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.projekt_context FROM anon, authenticated;
ALTER TABLE public.projekt_context ENABLE ROW LEVEL SECURITY;

-- sequence_runs
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.sequence_runs FROM anon, authenticated;
ALTER TABLE public.sequence_runs ENABLE ROW LEVEL SECURITY;

-- signatur_fritta_dokument
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.signatur_fritta_dokument FROM anon, authenticated;
ALTER TABLE public.signatur_fritta_dokument ENABLE ROW LEVEL SECURITY;

-- workflow_runs
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.workflow_runs FROM anon, authenticated;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- workflows
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.workflows FROM anon, authenticated;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- workflow_sequences
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.workflow_sequences FROM anon, authenticated;
ALTER TABLE public.workflow_sequences ENABLE ROW LEVEL SECURITY;

-- workflow_triggers
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers FROM anon, authenticated;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART B: selective read — 2 tables used by PWAs
-- ============================================================

-- aktivitetslogg_installningar: open-crm-app reads .aktiv column for toggle display
REVOKE INSERT, UPDATE, DELETE ON public.aktivitetslogg_installningar FROM anon, authenticated;
ALTER TABLE public.aktivitetslogg_installningar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_can_select"
  ON public.aktivitetslogg_installningar
  FOR SELECT TO authenticated
  USING (true);

-- projekt_statusar: open-crm-client reads namn + farg for status badges
REVOKE INSERT, UPDATE, DELETE ON public.projekt_statusar FROM anon, authenticated;
ALTER TABLE public.projekt_statusar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_can_select"
  ON public.projekt_statusar
  FOR SELECT TO authenticated
  USING (true);
