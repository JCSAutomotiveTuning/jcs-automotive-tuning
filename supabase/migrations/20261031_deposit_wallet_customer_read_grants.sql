-- Customer reads are limited by the existing user_id = auth.uid() RLS policies.
-- Authenticated users must have table-level SELECT for those policies to apply.
grant select on public.deposit_wallets to authenticated;
grant select on public.deposit_wallet_events to authenticated;
