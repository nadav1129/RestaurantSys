create table if not exists workers(
  worker_id uuid primary key,
  full_name text not null,
  phone_e164 text unique not null,
  is_admin boolean not null default false
);

create table if not exists shift_events(
  id uuid primary key,
  worker_id uuid not null references workers(worker_id),
  kind text not null check (kind in ('start','end')),
  at timestamptz not null default now()
);

create table if not exists reservations(
  reservation_id uuid primary key,
  name text not null,
  party_size int not null check (party_size > 0),
  starts_at timestamptz not null,
  google_event_id text,
  created_by_worker uuid references workers(worker_id),
  created_at timestamptz not null default now()
);

create table if not exists products(
  product_id uuid primary key,
  name text not null
);
