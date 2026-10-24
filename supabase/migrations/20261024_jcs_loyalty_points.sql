-- Run once in Supabase SQL Editor. One point per whole GBP of paid orders.
-- Existing wallet balances and Stripe webhook are untouched.
create table if not exists public.jcs_loyalty_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 points integer not null check (points >= 0),
 created_at timestamptz not null default now(),
 unique(order_id)
);
create index if not exists jcs_loyalty_user_idx on public.jcs_loyalty_ledger(user_id,created_at desc);
alter table public.jcs_loyalty_ledger enable row level security;
revoke all on public.jcs_loyalty_ledger from anon, authenticated;
grant select on public.jcs_loyalty_ledger to authenticated;
drop policy if exists "loyalty_owner_read" on public.jcs_loyalty_ledger;
create policy "loyalty_owner_read" on public.jcs_loyalty_ledger for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create or replace function public.jcs_sync_order_loyalty() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.payment_status = 'paid' and new.currency = 'GBP' and new.amount_pence > 0 then
  insert into public.jcs_loyalty_ledger(user_id,order_id,points)
  values(new.user_id,new.id, floor(new.amount_pence::numeric/100)::integer)
  on conflict(order_id) do update set points = excluded.points, user_id = excluded.user_id;
 else
  delete from public.jcs_loyalty_ledger where order_id = new.id;
 end if;
 return new;
end $$;
revoke all on function public.jcs_sync_order_loyalty() from public, anon, authenticated;
drop trigger if exists jcs_loyalty_order_sync on public.orders;
create trigger jcs_loyalty_order_sync after insert or update of payment_status,amount_pence,currency on public.orders for each row execute function public.jcs_sync_order_loyalty();
insert into public.jcs_loyalty_ledger(user_id,order_id,points)
select user_id,id,floor(amount_pence::numeric/100)::integer from public.orders
where payment_status='paid' and currency='GBP' and amount_pence >= 100
on conflict(order_id) do update set points=excluded.points,user_id=excluded.user_id;
-- This is a points-only launch. Redemption, referral bonuses and tier multipliers are not enabled.
