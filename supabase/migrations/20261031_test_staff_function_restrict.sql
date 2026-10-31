-- Older test project used public.is_staff() from its RLS policies.
-- Admin check runs with SECURITY DEFINER; no anonymous RPC exposure is needed.
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
