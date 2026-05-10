-- Lock the table down: anon and authenticated cannot touch signatur_lankar
-- directly. Only service_role (CRM admin) and the SECURITY DEFINER RPCs above
-- read/write it. The RPCs are explicitly granted to anon/authenticated.

ALTER TABLE signatur_lankar ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → no direct access.
