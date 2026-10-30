-- Library removal is non-destructive: the source order_file and Storage bytes remain untouched.
create table if not exists public.original_file_library_exclusions (
  file_id uuid primary key references public.order_files(id) on delete cascade,
  removed_by uuid not null references auth.users(id),
  removed_at timestamptz not null default now()
);
alter table public.original_file_library_exclusions enable row level security;
revoke all on public.original_file_library_exclusions from public, anon, authenticated;
-- Service role access only. Admin authorization is checked in the server endpoint.
