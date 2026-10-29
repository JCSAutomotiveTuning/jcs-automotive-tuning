-- Staged only: apply to TEST Supabase before enabling JCS_WALLET_DEPOSITS_ENABLED.
alter table public.orders add column if not exists deposit_pence integer not null default 0;
alter table public.orders add constraint orders_deposit_bounds check (deposit_pence >= 0 and deposit_pence <= amount_pence) not valid;
-- Server-role only: create an order and reserve its £20 deposit in one database transaction.
create or replace function public.create_wallet_deposit_order(
 p_user_id uuid, p_service_code text, p_service_name text, p_amount_pence integer,
 p_vehicle_make text, p_vehicle_model text, p_engine_code text,
 p_software_id text, p_customer_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_balance integer; v_active integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if p_user_id is null or p_amount_pence < 2000 or p_amount_pence > 100000000
    or length(p_service_code) not between 1 and 80
    or length(p_vehicle_make) not between 1 and 60
    or length(p_vehicle_model) not between 1 and 80 then raise exception 'Invalid deposit order'; end if;
 insert into public.customer_wallets(user_id,balance_pence) values(p_user_id,0) on conflict(user_id) do nothing;
 select balance_pence into v_balance from public.customer_wallets where user_id=p_user_id for update;
 if v_balance < 2000 then raise exception 'Insufficient wallet credit: £20 minimum required'; end if;
 select count(*) into v_active from public.orders where user_id=p_user_id
   and status not in ('completed','cancelled','failed');
 if v_active >= 3 then raise exception 'Active order limit reached'; end if;
 insert into public.orders(user_id,service_code,service_name,amount_pence,currency,status,payment_status,
  vehicle_make,vehicle_model,engine_code,software_id,customer_notes,deposit_pence)
 values(p_user_id,p_service_code,p_service_name,p_amount_pence,'GBP','awaiting_review','unpaid',
  p_vehicle_make,p_vehicle_model,p_engine_code,p_software_id,p_customer_notes,2000) returning id into v_id;
 update public.customer_wallets set balance_pence=balance_pence-2000,updated_at=now() where user_id=p_user_id;
 insert into public.wallet_transactions(user_id,amount_pence,transaction_type,order_id,description)
 values(p_user_id,-2000,'order_deposit',v_id,'£20 order deposit credited against final service price');
 return v_id;
end $$;
revoke all on function public.create_wallet_deposit_order(uuid,text,text,integer,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_wallet_deposit_order(uuid,text,text,integer,text,text,text,text,text) to service_role;
