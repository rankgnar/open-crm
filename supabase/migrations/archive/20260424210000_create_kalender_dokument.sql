create table kalender_event_dokument (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references kalender_events(id) on delete cascade,
  filnamn text not null,
  mime_type text not null default '',
  storlek bigint not null default 0,
  storage_path text not null,
  skapad_at timestamptz not null default now()
);

create index kalender_event_dokument_event_idx on kalender_event_dokument(event_id);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('kalender-dokument', 'kalender-dokument', false)
on conflict (id) do nothing;

-- RLS: allow anon/authenticated (same as projekt-dokument)
create policy "kalender dokument allow all"
  on storage.objects for all
  to anon, authenticated
  using (bucket_id = 'kalender-dokument')
  with check (bucket_id = 'kalender-dokument');
