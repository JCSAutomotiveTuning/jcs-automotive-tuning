-- Run once in Supabase SQL editor. Do not execute before backing up your database.
create table if not exists public.technical_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 service_type text not null check (service_type in ('parts','wiring')),
 registration text not null check (char_length(registration) between 2 and 12),
 make text not null check (make in ('Volkswagen','Audi','SEAT','Skoda','CUPRA')),
 model text not null check (char_length(model) between 1 and 100),
 model_year integer not null check (model_year between 1950 and 2100),
 vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
 engine_code text,
 module_reference text,
 description text not null check (char_length(description) between 10 and 5000),
 status text not null default 'awaiting_payment' check (status in ('awaiting_payment','paid','in_progress','needs_customer_info','completed','cancelled')),
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
 amount_pence integer not null default 1500 check (amount_pence=1500),
 currency text not null default 'GBP' check (currency='GBP'),
 stripe_session_id text unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists technical_requests_user_created_idx on public.technical_requests(user_id,created_at desc);
create index if not exists technical_requests_status_idx on public.technical_requests(status,created_at desc);
alter table public.technical_requests enable row level security;
revoke all on public.technical_requests from anon, authenticated;
grant select on public.technical_requests to authenticated;
drop policy if exists technical_requests_own_select on public.technical_requests;
create policy technical_requests_own_select on public.technical_requests for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.technical_request_messages (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.technical_requests(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 sender_role text not null check(sender_role in ('customer','admin')),
 body text not null check(char_length(body) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index if not exists technical_messages_request_idx on public.technical_request_messages(request_id,created_at);
alter table public.technical_request_messages enable row level security;
revoke all on public.technical_request_messages from anon,authenticated;
grant select on public.technical_request_messages to authenticated;
drop policy if exists technical_messages_own_select on public.technical_request_messages;
create policy technical_messages_own_select on public.technical_request_messages for select to authenticated using (
 exists(select 1 from public.technical_requests r where r.id=request_id and r.user_id=(select auth.uid()))
);

create table if not exists public.technical_request_files (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.technical_requests(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null,
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 created_at timestamptz not null default now()
);
create index if not exists technical_files_request_idx on public.technical_request_files(request_id);
alter table public.technical_request_files enable row level security;
revoke all on public.technical_request_files from anon,authenticated;
grant select on public.technical_request_files to authenticated;
drop policy if exists technical_files_own_select on public.technical_request_files;
create policy technical_files_own_select on public.technical_request_files for select to authenticated using (
 exists(select 1 from public.technical_requests r where r.id=request_id and r.user_id=(select auth.uid()) and r.payment_status='paid')
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('technical-deliverables','technical-deliverables',false,10485760,array['application/pdf','text/plain','text/csv','image/png','image/jpeg','application/zip'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
-- No public storage policies: only authenticated server routes using the service key may upload or sign downloads.
