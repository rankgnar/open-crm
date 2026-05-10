alter table kalender_events
  add column fas_id uuid references forslag_faser(id) on delete set null;

create index kalender_events_fas_idx on kalender_events(fas_id);
