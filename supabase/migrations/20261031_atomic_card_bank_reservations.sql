-- Stripe checkout and manual bank transfer reservation must share an order-level row lock.
-- Prevents two concurrent requests from independently passing separate API preflight checks.
create or replace function public.reserve_order_checkout(p_order_id uuid,p_user_id uuid)
returns table(attempt_id uuid,session_id text,session_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_attempt uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=p_user_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status<>'awaiting_payment' or v_order.payment_status<>'unpaid'
    or v_order.currency<>'GBP' or v_order.amount_pence-coalesce(v_order.deposit_pence,0)<=0
 then raise exception 'Order is not payable'; end if;
 if exists(select 1 from public.order_bank_transfers where order_id=p_order_id)
 then raise exception 'Bank transfer already reserved; do not create card checkout'; end if;
 if v_order.checkout_attempt_id is not null then
   return query select v_order.checkout_attempt_id,v_order.checkout_session_id,v_order.checkout_session_expires_at;
   return;
 end if;
 if v_order.checkout_session_id is not null then raise exception 'Existing checkout requires reconciliation'; end if;
 v_attempt:=gen_random_uuid();
 update public.orders set checkout_attempt_id=v_attempt,checkout_reserved_at=now(),updated_at=now()
 where id=p_order_id;
 return query select v_attempt,null::text,null::timestamptz;
end $$;
revoke all on function public.reserve_order_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_order_checkout(uuid,uuid) to service_role;

create or replace function public.reserve_order_bank_transfer(
 p_order_id uuid,p_user_id uuid,p_amount_pence integer,p_reference text
) returns text language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_bank public.order_bank_transfers%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=p_user_id for update;
 if not found then return 'not_found'; end if;
 if v_order.status<>'awaiting_payment' or v_order.payment_status<>'unpaid' or v_order.currency<>'GBP'
  or p_amount_pence<=0 or v_order.amount_pence-coalesce(v_order.deposit_pence,0)<>p_amount_pence
 then return 'not_payable'; end if;
 if v_order.checkout_attempt_id is not null or v_order.checkout_session_id is not null then return 'card_checkout_exists'; end if;
 if p_reference <> 'JCS-'||upper(left(replace(p_order_id::text,'-',''),16))
 then return 'invalid_reference'; end if;
 select * into v_bank from public.order_bank_transfers where order_id=p_order_id for update;
 if found then
   if v_bank.state='awaiting_transfer' and v_bank.amount_pence=p_amount_pence
      and v_bank.user_id=p_user_id and v_bank.reference=p_reference then return 'existing'; end if;
   return 'needs_reconciliation';
 end if;
 insert into public.order_bank_transfers(order_id,user_id,amount_pence,reference)
 values(p_order_id,p_user_id,p_amount_pence,p_reference);
 return 'created';
end $$;
revoke all on function public.reserve_order_bank_transfer(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_order_bank_transfer(uuid,uuid,integer,text) to service_role;
