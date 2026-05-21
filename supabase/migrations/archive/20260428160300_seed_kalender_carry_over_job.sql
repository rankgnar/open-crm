-- ============================================================
-- Seed the first cron job: kalender_carry_over.
--
-- Disabled by default — the user activates it from
-- Avancerat → Cron after confirming the function works
-- (via "Kör nu") on staged data.
--
-- Schedule: '0 23 * * *' UTC ≈ 00:00 Europe/Stockholm winter
-- (CET, UTC+1) and 01:00 Europe/Stockholm summer (CEST, UTC+2).
-- The function itself uses Europe/Stockholm to decide what
-- counts as "yesterday", so DST drift only shifts when the
-- job runs, not what it touches. The user can edit the cron
-- expression from the UI if desired.
-- ============================================================

insert into public.cron_jobs (
  id, label, description, schedule, sql_command, enabled
) values (
  'kalender_carry_over',
  'Flytta ej slutförda händelser till idag',
  'Körs varje natt och flyttar gårdagens (och äldre) ej slutförda kalenderhändelser till dagens datum. Återkommande händelser hoppas över.',
  '0 23 * * *',
  'select public.carry_over_kalender();',
  false
)
on conflict (id) do nothing;
