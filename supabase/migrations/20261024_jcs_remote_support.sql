-- JCS Remote Support: attended RustDesk sessions only. No passwords stored.
create table if not exists public.jcs_remote_support_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check (char_length(subject) between 3 and 120),
 details text not null check (char_length(details) between 10 and 3000),
 rustdesk_id text check (rustdesk_id is null or (char_length(rustdesk_id) between 4 and 40 and rustdesk_id ~ '^[A-Za-z0-9 -]+$')),
 status text not null default 'pending' check (status in ('pending','accepted','in_progress','completed','cancelled')),
 admin_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists jcs_remote_support_user_created_idx on public.jcs_remote_support_requests(user_id,created_at desc);
create index if not exists jcs_remote_support_status_created_idx on public.jcs_remote_support_requests(status,created_at desc);
alter table public.jcs_remote_support_requests enable row level security;
revoke all on public.jcs_remote_support_requests from anon, authenticated;
grant select,insert on public.jcs_remote_support_requests to authenticated;
drop policy if exists jcs_remote_support_select on public.jcs_remote_support_requests;
create policy jcs_remote_support_select on public.jcs_remote_support_requests for select to authenticated using (
 user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists jcs_remote_support_insert on public.jcs_remote_support_requests;
create policy jcs_remote_support_insert on public.jcs_remote_support_requests for insert to authenticated with check (
 user_id = (select auth.uid()) and status = 'pending' and admin_notes is null
);
-- No UPDATE/DELETE grants to authenticated; admin updates use server-side authenticated API.
