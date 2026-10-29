-- Staged only: apply to TEST Supabase before enabling JCS_WALLET_DEPOSITS_ENABLED.
alter table public.orders add column if not exists deposit_pence integer not null default 0;
alter table public.orders add constraint orders_deposit_bounds check (deposit_pence >= 0 and (amount_pence = 0 or deposit_pence <= amount_pence)) not valid;
-- The old wallet includes pre-launch test-mode credits. Do not transfer them.
create table if not exists public.deposit_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance_pence integer not null default 0 check (balance_pence >= 0),
 updated_at timestamptz not null default now()
);
create table if not exists public.deposit_wallet_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 amount_pence integer not null,
 transaction_type text not null check (transaction_type in ('top_up','order_deposit','deposit_release')),
 stripe_session_id text unique,
 order_id uuid references public.orders(id),
 description text,
 created_at timestamptz not null default now()
);
create unique index if not exists deposit_wallet_event_order_once on public.deposit_wallet_events(order_id) where transaction_type='order_deposit';
alter table public.deposit_wallets enable row level security;
alter table public.deposit_wallet_events enable row level security;
create policy "read own deposit balance" on public.deposit_wallets for select to authenticated using (user_id=auth.uid());
create policy "read own deposit transactions" on public.deposit_wallet_events for select to authenticated using (user_id=auth.uid());
-- Server-role only: create an order and reserve its £20 deposit in one database transaction.
create or replace function public.create_wallet_deposit_order(
 p_user_id uuid, p_service_code text, p_service_name text, p_amount_pence integer,
 p_vehicle_make text, p_vehicle_model text, p_engine_code text,
 p_software_id text, p_customer_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_balance integer; v_active integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if p_user_id is null or p_amount_pence < 0 or p_amount_pence > 100000000
    or length(p_service_code) not between 1 and 80
    or length(p_vehicle_make) not between 1 and 60
    or length(p_vehicle_model) not between 1 and 80 then raise exception 'Invalid deposit order'; end if;
 insert into public.deposit_wallets(user_id,balance_pence) values(p_user_id,0) on conflict(user_id) do nothing;
 select balance_pence into v_balance from public.deposit_wallets where user_id=p_user_id for update;
 if v_balance < 2000 then raise exception 'Insufficient wallet credit: £20 minimum required'; end if;
 select count(*) into v_active from public.orders where user_id=p_user_id
   and status not in ('completed','cancelled','failed');
 if v_active >= 3 then raise exception 'Active order limit reached'; end if;
 insert into public.orders(user_id,service_code,service_name,amount_pence,currency,status,payment_status,
  vehicle_make,vehicle_model,engine_code,software_id,customer_notes,deposit_pence)
 values(p_user_id,p_service_code,p_service_name,p_amount_pence,'GBP','awaiting_review','unpaid',
  p_vehicle_make,p_vehicle_model,p_engine_code,p_software_id,p_customer_notes,2000) returning id into v_id;
 update public.deposit_wallets set balance_pence=balance_pence-2000,updated_at=now() where user_id=p_user_id;
 insert into public.deposit_wallet_events(user_id,amount_pence,transaction_type,order_id,description)
 values(p_user_id,-2000,'order_deposit',v_id,'£20 order deposit credited against final service price');
 return v_id;
end $$;
revoke all on function public.create_wallet_deposit_order(uuid,text,text,integer,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_wallet_deposit_order(uuid,text,text,integer,text,text,text,text,text) to service_role;

-- Idempotent confirmation of the remaining Stripe balance. Existing orders use the legacy RPC.
create or replace function public.confirm_wallet_deposit_order_payment(
 p_order_id uuid, p_user_id uuid, p_attempt_id uuid, p_session_id text, p_amount_pence integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if p_session_id !~ '^cs_(test|live)_' or p_amount_pence <= 0 or p_attempt_id is null then return 'invalid'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=p_user_id for update;
 if not found then return 'not_found'; end if;
 if v_order.currency <> 'GBP' or v_order.deposit_pence <> 2000
    or v_order.amount_pence - v_order.deposit_pence <> p_amount_pence
    or v_order.checkout_attempt_id is distinct from p_attempt_id then return 'mismatch'; end if;
 if v_order.payment_status='paid' then
   if v_order.stripe_payment_session_id=p_session_id then return 'already_confirmed'; end if;
   return 'different_payment';
 end if;
 if v_order.status <> 'awaiting_payment' or v_order.payment_status <> 'unpaid'
    or (v_order.checkout_session_id is not null and v_order.checkout_session_id <> p_session_id)
 then return 'not_payable'; end if;
 update public.orders set checkout_session_id=p_session_id,stripe_payment_session_id=p_session_id,
   payment_status='paid',status='paid',updated_at=now() where id=p_order_id;
 return 'confirmed';
end $$;
revoke all on function public.confirm_wallet_deposit_order_payment(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.confirm_wallet_deposit_order_payment(uuid,uuid,uuid,text,integer) to service_role;

create or replace function public.credit_deposit_wallet_topup(p_user_id uuid,p_session_id text,p_amount_pence integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if p_user_id is null or p_session_id !~ '^cs_(test|live)_' or p_amount_pence not in (2000,4000,10000)
 then raise exception 'Invalid deposit wallet top-up'; end if;
 insert into public.deposit_wallets(user_id,balance_pence) values(p_user_id,0) on conflict(user_id) do nothing;
 insert into public.deposit_wallet_events(user_id,amount_pence,transaction_type,stripe_session_id,description)
 values(p_user_id,p_amount_pence,'top_up',p_session_id,'Stripe deposit wallet top-up')
 on conflict(stripe_session_id) do nothing returning id into v_id;
 if v_id is null then return false; end if;
 update public.deposit_wallets set balance_pence=balance_pence+p_amount_pence,updated_at=now() where user_id=p_user_id;
 return true;
end $$;
revoke all on function public.credit_deposit_wallet_topup(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.credit_deposit_wallet_topup(uuid,text,integer) to service_role;

-- Fully deposit-covered £20 jobs need no second Stripe charge.
create or replace function public.settle_fully_deposit_paid_order(p_order_id uuid,p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then return 'not_found'; end if;
 if v_order.status='paid' and v_order.payment_status='paid' then return 'already_settled'; end if;
 if v_order.status<>'awaiting_review' or v_order.payment_status<>'unpaid'
   or v_order.amount_pence<>2000 or v_order.deposit_pence<>2000 then return 'not_eligible'; end if;
 if not exists(select 1 from public.deposit_wallet_events where order_id=p_order_id and user_id=v_order.user_id
      and transaction_type='order_deposit' and amount_pence=-2000) then return 'missing_deposit'; end if;
 if exists(select 1 from public.order_files where order_id=p_order_id and scan_status<>'clean') then return 'files_not_clean'; end if;
 update public.orders set status='paid',payment_status='paid',updated_at=now() where id=p_order_id;
 insert into public.order_audit(order_id,actor_id,action,details)
 values(p_order_id,p_user_id,'admin_order_updated',jsonb_build_object('action_type','wallet_deposit_fully_settled','amount_pence',2000));
 return 'settled';
end $$;
revoke all on function public.settle_fully_deposit_paid_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.settle_fully_deposit_paid_order(uuid,uuid) to service_role;

create unique index if not exists deposit_wallet_event_release_once on public.deposit_wallet_events(order_id)
 where transaction_type='deposit_release';
create or replace function public.release_cancelled_order_deposit(p_order_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_event uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then return 'not_found'; end if;
 if exists(select 1 from public.deposit_wallet_events where order_id=p_order_id and transaction_type='deposit_release')
 then return 'already_released'; end if;
 if v_order.status not in ('cancelled','failed') or v_order.payment_status<>'unpaid'
    or v_order.deposit_pence<>2000 then return 'not_eligible'; end if;
 if not exists(select 1 from public.deposit_wallet_events where order_id=p_order_id and transaction_type='order_deposit'
    and user_id=v_order.user_id and amount_pence=-2000) then return 'missing_deposit'; end if;
 insert into public.deposit_wallet_events(user_id,amount_pence,transaction_type,order_id,description)
 values(v_order.user_id,2000,'deposit_release',p_order_id,'Returned deposit for cancelled order')
 returning id into v_event;
 update public.deposit_wallets set balance_pence=balance_pence+2000,updated_at=now() where user_id=v_order.user_id;
 return 'released';
end $$;
revoke all on function public.release_cancelled_order_deposit(uuid) from public,anon,authenticated;
grant execute on function public.release_cancelled_order_deposit(uuid) to service_role;
