alter table kalender_events
  add column if not exists projekt_id uuid references projekt(id) on delete set null,
  add column if not exists url text not null default '';

create index if not exists kalender_events_projekt_idx on kalender_events(projekt_id);
