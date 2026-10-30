-- A single, concurrency-safe daily allowance for customer ECU/tool/vehicle lookups.
-- Date boundary: Europe/London midnight (BST/GMT).
create table if not exists public.customer_search_daily_usage(
 user_id uuid not null references auth.users(id) on delete cascade,
 search_day date not null,
 used integer not null default 0 check(used between 0 and 5),
 updated_at timestamptz not null default now(),
 primary key(user_id,search_day)
);
alter table public.customer_search_daily_usage enable row level security;
revoke all on public.customer_search_daily_usage from public,anon,authenticated;
create or replace function public.consume_customer_search()
returns table(allowed boolean, remaining integer, daily_limit integer, reset_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
 uid uuid := (select auth.uid());
 uk_day date := (now() at time zone 'Europe/London')::date;
 current_used integer;
 reset_time timestamptz := ((uk_day+1)::timestamp at time zone 'Europe/London');
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
  return query select true, 5, 5, reset_time;
  return;
 end if;
 insert into public.customer_search_daily_usage(user_id,search_day,used)
 values(uid,uk_day,1)
 on conflict(user_id,search_day) do update
 set used=public.customer_search_daily_usage.used+1,updated_at=now()
 where public.customer_search_daily_usage.used<5
 returning used into current_used;
 if current_used is null then
  return query select false, 0, 5, reset_time;
 else
  return query select true, 5-current_used, 5, reset_time;
 end if;
end $$;
revoke all on function public.consume_customer_search() from public,anon;
grant execute on function public.consume_customer_search() to authenticated;
