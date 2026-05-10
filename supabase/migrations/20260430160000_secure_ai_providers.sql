-- Lock down ai_providers from anon/authenticated.
-- Without this, any holder of the anon key (i.e. every web SPA bundle) can
-- read api_key/base_url for every AI provider. Same risk pattern as the
-- earlier app_installningar leak (fortnox_client_secret).
--
-- Unlike app_installningar, ai_providers has no public-safe columns at all.
-- Every row is internal config that only Electron main (service_role) needs
-- to read or modify. So we lock the table fully:
--   1. REVOKE all DML from anon/authenticated.
--   2. ENABLE RLS with no policies — PostgREST returns empty results for
--      anon and authenticated, even on columns they would otherwise have.
--
-- service_role bypasses RLS, so all main-process IPC handlers
-- (src/main/ipc/ai.ts, ai-chat-fn.ts, workspace.ts) keep working unchanged.

REVOKE SELECT, INSERT, UPDATE, DELETE ON ai_providers FROM anon, authenticated;

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
