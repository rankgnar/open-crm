create table projekt_sms_log (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references projekt(id) on delete cascade,
  mall_namn text not null default '',
  meddelande text not null,
  skapad_at timestamptz not null default now()
);

create index on projekt_sms_log(projekt_id, skapad_at desc);
