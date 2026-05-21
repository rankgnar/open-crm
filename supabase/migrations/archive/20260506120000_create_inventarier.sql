create table if not exists inventarier (
  id                  uuid        primary key default gen_random_uuid(),
  lopnr               serial      not null,
  kategori            text        not null default '',
  benamning           text        not null default '',
  tillverkare_modell  text        not null default '',
  serienr             text        not null default '',
  antal               integer     not null default 1,
  skick               text        not null default 'Bra',
  placering           text        not null default '',
  updated_by_user_id  uuid,
  updated_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists inventarier_lopnr_idx on inventarier (lopnr);

alter table inventarier enable row level security;

-- Authenticated app users can read all inventory items
create policy "authenticated_read_inventarier"
  on inventarier for select
  to authenticated
  using (true);

-- Authenticated app users can update items (antal, skick, placering) during inventory pass
create policy "authenticated_update_inventarier"
  on inventarier for update
  to authenticated
  using (true)
  with check (true);
