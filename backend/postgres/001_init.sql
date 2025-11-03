set search_path to public;
create extension if not exists pgcrypto;

-- Core
create table if not exists workers(
  worker_id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text unique not null,
  is_admin boolean not null default false
);

create table if not exists shift_events(
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(worker_id),
  kind text not null check (kind in ('start','end')),
  at timestamptz not null default now()
);

create table if not exists reservations(
  reservation_id uuid primary key default gen_random_uuid(),
  name text not null,
  party_size int not null check (party_size > 0),
  starts_at timestamptz not null,
  google_event_id text,
  created_by_worker uuid references workers(worker_id),
  created_at timestamptz not null default now()
);

create table if not exists warehouse_draws(
  draw_id uuid primary key default gen_random_uuid(),
  bottle_name text not null,
  ml int not null check (ml > 0),
  at timestamptz not null default now(),
  worker_id uuid references workers(worker_id)
);

create table if not exists payments(
  payment_id uuid primary key default gen_random_uuid(),
  table_no int,
  amount numeric(10,2) not null,
  paid_at timestamptz not null default now(),
  note text
);

create table if not exists webhook_receipts(
  message_id text primary key,
  received_at timestamptz not null default now()
);

insert into workers(worker_id, full_name, phone_e164, is_admin)
values (gen_random_uuid(), 'Nadav', '+972549537630', true)
on conflict (phone_e164) do nothing;

-- Menu
create table if not exists public.menu_nodes (
  node_id     uuid primary key default gen_random_uuid(),
  parent_id   uuid null references public.menu_nodes(node_id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  is_leaf     boolean not null,
  price_cents int check (price_cents is null or price_cents >= 0),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ix_menu_nodes_parent  on public.menu_nodes(parent_id);
create index if not exists ix_menu_nodes_is_leaf on public.menu_nodes(is_leaf);

-- Ingredients & products (new schema)
create table if not exists ingredients (
  ingredient_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_unit text not null check (base_unit in ('Milliliter','Gram','Unit'))
);

-- ensure the "new" products layout wins
drop table if exists public.products;

create table if not exists products (
  product_id uuid primary key default gen_random_uuid(),
  menu_node_id uuid not null references public.menu_nodes(node_id) on delete cascade,
  name text not null,
  type text not null check (type in ('Bottle','Cocktail','Pour'))
);

create table if not exists product_components (
  component_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(product_id) on delete cascade,
  ingredient_id uuid not null references ingredients(ingredient_id),
  amount_ml numeric(10,2) not null,
  is_leading boolean not null default false,
  is_changeable boolean not null default false
);

create table if not exists speed_map (
  ingredient_id uuid primary key references ingredients(ingredient_id) on delete cascade,
  bottle_product_id uuid not null references products(product_id)
);

create table if not exists product_prices (
  product_id uuid primary key references products(product_id) on delete cascade,
  price numeric(10,2) not null
);

-- sanity
select to_regclass('public.menu_nodes') as menu_nodes_exists;
