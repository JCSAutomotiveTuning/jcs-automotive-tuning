-- Small fixed-price jobs still require £20 verified wallet credit before submission.
-- Reserve £20, then atomically return any unused part to the same wallet at
-- admin-confirmed settlement. Never create Stripe credits or a second checkout.
alter table public.orders drop constraint if exists orders_deposit_bounds;
alter table public.orders add constraint orders_deposit_bounds
  check (deposit_pence in (0, 2000) and amount_pence >= 0) not valid;

alter table public.deposit_wallet_events
  drop constraint if exists deposit_wallet_events_transaction_type_check;
alter table public.deposit_wallet_events
  add constraint deposit_wallet_events_transaction_type_check
  check (transaction_type in ('top_up','order_deposit','deposit_release','deposit_remainder'));

create unique index if not exists deposit_wallet_event_remainder_once
  on public.deposit_wallet_events(order_id)
  where transaction_type='deposit_remainder';

drop policy if exists "read own deposit balance" on public.deposit_wallets;
create policy "read own deposit balance" on public.deposit_wallets for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "read own deposit transactions" on public.deposit_wallet_events;
create policy "read own deposit transactions" on public.deposit_wallet_events for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.settle_fully_deposit_paid_order(
  p_order_id uuid,p_user_id uuid
) returns text language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_remainder integer; v_id uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='admin')
 then raise exception 'Administrator required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then return 'not_found'; end if;
 if v_order.status='paid' and v_order.payment_status='paid' then return 'already_settled'; end if;
 if v_order.status<>'awaiting_review' or v_order.payment_status<>'unpaid'
    or v_order.deposit_pence<>2000 or v_order.amount_pence not between 1 and 2000
    or v_order.checkout_session_id is not null or v_order.checkout_attempt_id is not null
 then return 'not_eligible'; end if;
 if not exists(select 1 from public.deposit_wallet_events
   where order_id=p_order_id and user_id=v_order.user_id
   and transaction_type='order_deposit' and amount_pence=-2000) then return 'missing_deposit'; end if;
 if v_order.service_code in ('ecu_stage1','dsg_tcu','log_review','datalog_analysis','custom_ecu','custom_tcu','ecu_tcu_package')
   and not exists(select 1 from public.order_files where order_id=p_order_id and kind='customer_original')
 then return 'missing_input_file'; end if;
 if exists(select 1 from public.order_files where order_id=p_order_id and scan_status<>'clean')
 then return 'files_not_clean'; end if;
 v_remainder := 2000-v_order.amount_pence;
 if v_remainder>0 then
   insert into public.deposit_wallet_events(user_id,amount_pence,transaction_type,order_id,description)
   values(v_order.user_id,v_remainder,'deposit_remainder',p_order_id,
     'Unused portion of £20 deposit returned after final price confirmation')
   on conflict do nothing returning id into v_id;
   if v_id is null then return 'already_reconciled'; end if;
   update public.deposit_wallets
     set balance_pence=balance_pence+v_remainder,updated_at=now()
     where user_id=v_order.user_id;
   if not found then raise exception 'Deposit wallet missing'; end if;
 end if;
 update public.orders set status='paid',payment_status='paid',updated_at=now() where id=p_order_id;
 insert into public.order_audit(order_id,actor_id,action,details)
 values(p_order_id,p_user_id,'admin_order_updated',
   jsonb_build_object('action_type','wallet_deposit_fully_settled',
     'service_pence',v_order.amount_pence,'deposit_pence',2000,
     'wallet_remainder_returned_pence',v_remainder));
 return 'settled';
end $$;
revoke all on function public.settle_fully_deposit_paid_order(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.settle_fully_deposit_paid_order(uuid,uuid)
  to service_role;
