-- ============================================================
-- Cron infrastructure: pg_cron extension + cron_jobs registry.
--
-- The `cron_jobs` table is the single source of truth shown in
-- Avancerat → Cron. A trigger keeps `cron.job` in sync: toggling
-- `enabled` or editing `schedule`/`sql_command` re-schedules the
-- pg_cron job; disabling unschedules it. Job ids in `cron_jobs`
-- map 1:1 to `cron.job.jobname`.
--
-- Production deployments must have pg_cron available. On Supabase
-- it lives in the `extensions` schema; we keep the extension where
-- it is and only reference `cron.schedule` / `cron.unschedule`.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists moddatetime with schema extensions;

create table if not exists public.cron_jobs (
  id            text primary key,
  label         text not null,
  description   text,
  schedule      text not null,
  sql_command   text not null,
  enabled       boolean not null default false,
  last_run_at   timestamptz,
  last_status   text,
  last_result   text,
  skapad_at     timestamptz not null default now(),
  uppdaterad_at timestamptz not null default now()
);

create trigger cron_jobs_updated_at
  before update on public.cron_jobs
  for each row execute function extensions.moddatetime(uppdaterad_at);

-- ------------------------------------------------------------
-- Sync trigger: reflect cron_jobs row state into pg_cron.
-- ------------------------------------------------------------

create or replace function public.sync_cron_job()
returns trigger
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  jobname_to_remove text := coalesce(old.id, new.id);
begin
  -- Always unschedule first if the job is currently scheduled.
  -- Keeps the logic idempotent and handles renames of
  -- schedule/command cleanly.
  if exists (select 1 from cron.job where jobname = jobname_to_remove) then
    perform cron.unschedule(jobname_to_remove);
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;

  if (new.enabled) then
    perform cron.schedule(new.id, new.schedule, new.sql_command);
  end if;

  return new;
end;
$$;

drop trigger if exists cron_jobs_sync on public.cron_jobs;
create trigger cron_jobs_sync
  after insert or update of enabled, schedule, sql_command or delete
  on public.cron_jobs
  for each row execute function public.sync_cron_job();

-- ------------------------------------------------------------
-- exec_cron_command: run a job's sql_command on demand from the
-- "Kör nu" button. Whitelisted via cron_jobs.id — only commands
-- already stored in the table can be executed, and only callers
-- with rights on cron_jobs (admins / service_role) can invoke
-- this RPC. The job's last_run / last_status / last_result are
-- updated by the job's own SQL command (e.g. carry_over_kalender).
-- ------------------------------------------------------------

create or replace function public.exec_cron_command(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cmd text;
begin
  select sql_command into cmd from public.cron_jobs where id = p_id;
  if cmd is null then
    raise exception 'cron job % not found', p_id;
  end if;
  execute cmd;
end;
$$;

-- Service_role bypasses these grants; the Electron desktop talks
-- via service_role and is the only intended caller for v1. Authed
-- web/mobile clients shouldn't be able to trigger jobs ad-hoc.
revoke all on function public.exec_cron_command(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS: cron_jobs is admin-only. The Electron desktop talks via
-- service_role and bypasses RLS; this gate is for any other
-- authenticated client (e.g. the mobile admin PWA, if it ever
-- needs to read cron status).
-- ------------------------------------------------------------

alter table public.cron_jobs enable row level security;

drop policy if exists cron_jobs_admin_all on public.cron_jobs;
create policy cron_jobs_admin_all on public.cron_jobs
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
