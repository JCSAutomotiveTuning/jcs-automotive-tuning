-- Metadata indexes customer-supplied ORIGINAL files; never copies or exposes bytes.
create table if not exists public.original_file_catalog (
  file_id uuid primary key references public.order_files(id) on delete cascade,
  hw_id text,
  sw_id text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint original_hw_valid check (hw_id is null or (length(hw_id) between 2 and 100 and hw_id ~ '^[a-zA-Z0-9._/-]+$')),
  constraint original_sw_valid check (sw_id is null or (length(sw_id) between 2 and 100 and sw_id ~ '^[a-zA-Z0-9._/-]+$')),
  constraint original_pair_complete check ((hw_id is null) = (sw_id is null))
);
create index if not exists original_catalog_hw_sw_idx on public.original_file_catalog (upper(hw_id),upper(sw_id)) where hw_id is not null and sw_id is not null;
alter table public.original_file_catalog enable row level security;
revoke all on public.original_file_catalog from anon,authenticated;
-- Only server-side service role may edit or read metadata.
-- Absence of a record means 'undefined' (including old uploads).
