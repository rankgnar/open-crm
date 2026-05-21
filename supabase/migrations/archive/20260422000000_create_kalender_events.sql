create extension if not exists moddatetime with schema extensions;

create table kalender_events (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beskrivning text not null default '',
  plats text not null default '',
  start timestamptz not null,
  slut timestamptz not null,
  hel_dag boolean not null default false,
  aterkommer boolean not null default false,
  deltagare jsonb not null default '[]',
  kund_id uuid references kunder(id) on delete set null,
  farg text not null default '#6366f1',
  skapad_at timestamptz not null default now(),
  uppdaterad_at timestamptz not null default now()
);

create index kalender_events_start_idx on kalender_events(start);
create index kalender_events_kund_idx on kalender_events(kund_id);

create trigger kalender_events_updated_at
  before update on kalender_events
  for each row execute function extensions.moddatetime(uppdaterad_at);
