-- Manual calendars users can create from the Kalender section sidebar.
-- Auto-grouped calendars (Lokal, Revisor, per-Kund, per-Projekt) keep working
-- as before; this table only adds named, color-customizable calendars that
-- events can opt in to via kalender_events.kalender_id.

create table if not exists kalendrar (
  id uuid primary key default gen_random_uuid(),
  namn text not null,
  farg text not null default '#6366f1',
  sortering int not null default 0,
  skapad_at timestamptz not null default now(),
  uppdaterad_at timestamptz not null default now()
);

create trigger kalendrar_updated_at
  before update on kalendrar
  for each row execute function extensions.moddatetime(uppdaterad_at);

alter table kalender_events
  add column if not exists kalender_id uuid references kalendrar(id) on delete set null;

create index if not exists kalender_events_kalender_idx on kalender_events(kalender_id);

-- Optional per-Kund / per-Projekt color overrides. NULL = fall back to the
-- index-based palette in the renderer.
alter table kunder  add column if not exists kalender_farg text;
alter table projekt add column if not exists kalender_farg text;
