-- Older TEST project has a legacy public.is_staff() helper in RLS policies.
-- Production does not have this function. Safe on both projects.
do $$
begin
 if to_regprocedure('public.is_staff()') is not null then
   revoke execute on function public.is_staff() from public, anon;
   grant execute on function public.is_staff() to authenticated;
 end if;
end $$;
