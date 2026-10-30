create table if not exists public.order_bank_transfers(
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 amount_pence integer not null check(amount_pence>0),
 reference text not null unique,
 state text not null default 'awaiting_transfer' check(state in ('awaiting_transfer','confirmed','cancelled')),
 requested_at timestamptz not null default now(),
 confirmed_at timestamptz,
 confirmed_by uuid references auth.users(id),
 bank_transaction_reference text
);
alter table public.order_bank_transfers enable row level security;
revoke all on public.order_bank_transfers from public,anon,authenticated;
create index if not exists order_bank_transfers_customer_idx on public.order_bank_transfers(user_id,requested_at desc);

-- Called only using the server's service-role connection AFTER verifying administrator role.
-- Transactional status update prevents mistaken customer-side or duplicate confirmation.
create or replace function public.confirm_manual_bank_transfer(p_order_id uuid,p_admin_id uuid,p_bank_reference text)
returns text language plpgsql security definer set search_path=''
as $$
declare
 rec public.order_bank_transfers%rowtype;
 ord public.orders%rowtype;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Admin required'; end if;
 if length(trim(p_bank_reference))<3 or length(p_bank_reference)>120 then raise exception 'Bank transaction reference required'; end if;
 select * into rec from public.order_bank_transfers where order_id=p_order_id for update;
 if not found then raise exception 'No bank transfer selected for this order'; end if;
 if rec.state='confirmed' then return 'already_confirmed'; end if;
 if rec.state<>'awaiting_transfer' then raise exception 'Transfer is not pending'; end if;
 select * into ord from public.orders where id=p_order_id for update;
 if ord.payment_status<>'unpaid' or ord.status<>'awaiting_payment'
 or ord.user_id<>rec.user_id or greatest(ord.amount_pence-coalesce(ord.deposit_pence,0),0)<>rec.amount_pence
 then raise exception 'Order amount or state has changed; review before confirmation'; end if;
 update public.orders set payment_status='paid' where id=p_order_id;
 update public.order_bank_transfers set state='confirmed',confirmed_at=now(),confirmed_by=p_admin_id,bank_transaction_reference=trim(p_bank_reference) where order_id=p_order_id;
 insert into public.order_audit(order_id,actor_id,action,details) values(p_order_id,p_admin_id,'admin_order_updated',jsonb_build_object('action_type','bank_transfer_confirmed','amount_pence',rec.amount_pence,'reference',rec.reference,'bank_transaction_reference',trim(p_bank_reference)));
 return 'confirmed';
end $$;
revoke all on function public.confirm_manual_bank_transfer(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_manual_bank_transfer(uuid,uuid,text) to service_role;
