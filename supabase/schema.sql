create extension if not exists pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
create type public.order_status as enum ('awaiting_review','awaiting_payment','paid','in_progress','needs_customer_info','qa_review','completed','cancelled','failed');
create type public.payment_status as enum ('unpaid','pending','paid','refunded','disputed');
create type public.file_kind as enum ('customer_original','working_copy','completed_output','diagnostic_log');
create type public.scan_status as enum ('pending','clean','blocked','error');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email) values(new.id,new.email)
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  service_code text not null,
  service_name text not null,
  amount_pence integer not null check (amount_pence >= 0),
  currency text not null default 'GBP' check (currency='GBP'),
  status public.order_status not null default 'awaiting_review',
  payment_status public.payment_status not null default 'unpaid',
  vehicle_make text not null,
  vehicle_model text not null,
  engine_code text,
  software_id text,
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind public.file_kind not null default 'customer_original',
  scan_status public.scan_status not null default 'pending',
  sha256 text,
  created_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('stripe','paypal')),
  provider_event_id text not null,
  provider_transaction_id text,
  amount_pence integer not null,
  currency text not null,
  event_type text not null,
  verified boolean not null default false,
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table public.order_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_user_created_idx on public.orders(user_id,created_at desc);
create index orders_status_created_idx on public.orders(status,created_at desc);
create index order_files_order_idx on public.order_files(order_id,created_at);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;
alter table public.payment_events enable row level security;
alter table public.order_audit enable row level security;

create function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','technician')); $$;

create policy "profile owner can read own profile"
on public.profiles for select to authenticated
using (id=auth.uid() or public.is_staff());

create policy "customers read own orders; staff read all"
on public.orders for select to authenticated
using (user_id=auth.uid() or public.is_staff());

create policy "customers create own orders"
on public.orders for insert to authenticated
with check (user_id=auth.uid() and payment_status='unpaid');

create policy "customers read own file metadata; staff read all"
on public.order_files for select to authenticated
using (user_id=auth.uid() or public.is_staff());

create policy "customers register own uploaded file metadata"
on public.order_files for insert to authenticated
with check (
  user_id=auth.uid()
  and kind='customer_original'
  and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
);

create policy "staff read payment events"
on public.payment_events for select to authenticated
using (public.is_staff());

create policy "staff read audit"
on public.order_audit for select to authenticated
using (public.is_staff());

-- No customer update/delete policies are intentionally provided for orders, payment events or audit rows.
-- The service-role key bypasses RLS and must remain server-only.
