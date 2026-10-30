-- Optional precise ECU/tool dimensions; only populate from exact, licensed vendor protocol data.
alter table public.vehicle_ecu_references add column if not exists ecu_hw_id text;
alter table public.vehicle_ecu_references add column if not exists ecu_sw_id text;
alter table public.vehicle_ecu_references add column if not exists mcu text;
alter table public.vehicle_ecu_references add column if not exists fuel_type text;
alter table public.vehicle_ecu_references add column if not exists tool_protocol text;
alter table public.vehicle_ecu_references add column if not exists software_package text;
alter table public.vehicle_ecu_references add column if not exists unlock_required boolean;
alter table public.vehicle_ecu_references add column if not exists source_checked_at timestamptz;
alter table public.vehicle_ecu_references add column if not exists technician_notes text;
create index if not exists vehicle_ecu_refs_hw_idx on public.vehicle_ecu_references (lower(ecu_hw_id)) where ecu_hw_id is not null;
create index if not exists vehicle_ecu_refs_sw_idx on public.vehicle_ecu_references (lower(ecu_sw_id)) where ecu_sw_id is not null;
