-- ============================================================
-- kalender_events: introduce a "completed" flag.
--
-- Required by the carry-over job that, every night at 00:00
-- Europe/Stockholm, moves yesterday's unfinished events to
-- today's date. Without a completion flag we can't tell which
-- events to move.
-- ============================================================

alter table public.kalender_events
  add column if not exists slutford boolean not null default false;

-- Partial index: the carry-over job only ever filters on
-- `slutford = false`, so a partial index keeps the work cheap
-- and the index small.
create index if not exists kalender_events_open_idx
  on public.kalender_events(start)
  where slutford = false;
