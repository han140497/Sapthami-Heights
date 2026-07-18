-- Resident vehicle registration.
--
-- Vehicles belong to a flat (parking is allocated per flat), with an optional link to
-- the resident who owns the vehicle. A resident manages the vehicles for their own
-- flat; the committee/admin can manage any flat's. Access is scoped by the server —
-- the flat comes from the resident's signed cookie, never from the request — and RLS
-- stays deny-all as defence in depth, exactly like every other table here.

create table vehicles (
  id                  uuid primary key default gen_random_uuid(),
  flat_id             uuid not null references flats(id) on delete cascade,
  -- Optional: which resident owns it. Cleared, not cascaded, if the resident record
  -- is removed — the vehicle and its parking slot belong to the flat, not the person.
  resident_id         uuid references residents(id) on delete set null,
  vehicle_type        text not null check (vehicle_type in ('car', 'bike', 'scooter', 'bicycle', 'other')),
  registration_number text not null check (length(trim(registration_number)) > 0),
  make_model          text,
  color               text,
  parking_slot        text,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index vehicles_flat_idx on vehicles (flat_id);

-- Registration numbers are unique in the real world; keep them so among active
-- vehicles to stop the same plate being registered to two flats. Stored uppercased
-- and space-stripped so "TS 09 AB 1234" and "ts09ab1234" are recognised as the same.
create unique index vehicles_unique_active_reg
  on vehicles (registration_number)
  where is_active;

create or replace function vehicles_normalise()
returns trigger
language plpgsql
as $$
begin
  new.registration_number := upper(regexp_replace(new.registration_number, '\s+', '', 'g'));
  new.updated_at := now();
  return new;
end;
$$;

create trigger vehicles_normalise_trg
  before insert or update on vehicles
  for each row execute function vehicles_normalise();

-- Deny-all RLS: the server is the access boundary (residents have no Supabase
-- identity), so this table, like the rest, fails closed if a key ever leaks.
alter table vehicles enable row level security;
alter table vehicles force row level security;

-- Audit trail: vehicle changes are captured, in case a parking dispute ever needs a
-- record of who registered what and when. Reuses the shared audit function.
create trigger vehicles_audit_trg
  after insert or update or delete on vehicles
  for each row execute function audit_row_change();
