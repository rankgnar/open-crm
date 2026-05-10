-- ============================================================
-- carry_over_kalender(): the function the nightly cron job runs.
--
-- Moves every kalender_events row that:
--   * is not yet completed (slutford = false)
--   * is not a recurring event (aterkommer = false)
--   * has a start date (in Europe/Stockholm) before today
-- ...to today's date, preserving its local time-of-day. Returns
-- a jsonb summary and writes the same summary into cron_jobs as
-- last_status / last_result.
--
-- Recurring events are skipped on purpose: they have their own
-- repetition logic and shouldn't be dragged forward.
-- ============================================================

create or replace function public.carry_over_kalender()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Europe/Stockholm')::date;
  moved_count int;
begin
  with updated as (
    update public.kalender_events e
    set
      start = (today_local + ((e.start at time zone 'Europe/Stockholm')::time))
              at time zone 'Europe/Stockholm',
      slut  = (today_local + ((e.slut  at time zone 'Europe/Stockholm')::time))
              at time zone 'Europe/Stockholm',
      uppdaterad_at = now()
    where e.slutford = false
      and e.aterkommer = false
      and (e.start at time zone 'Europe/Stockholm')::date < today_local
    returning 1
  )
  select count(*) into moved_count from updated;

  update public.cron_jobs
  set last_run_at = now(),
      last_status = 'ok',
      last_result = jsonb_build_object('moved', moved_count)::text
  where id = 'kalender_carry_over';

  return jsonb_build_object('moved', moved_count);
exception when others then
  update public.cron_jobs
  set last_run_at = now(),
      last_status = 'error',
      last_result = sqlerrm
  where id = 'kalender_carry_over';
  raise;
end;
$$;
