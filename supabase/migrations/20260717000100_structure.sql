-- Sapthami Heights — building structure, people, and committee.
--
-- Security model (see also 20260717000600_rls.sql):
-- Residents have NO Supabase identity — they authenticate with block + flat + phone
-- against a server route, which holds the service-role key. There is therefore no
-- auth.uid() to scope residents by, and RLS cannot be the resident access boundary.
-- The server route is. RLS here is deny-all defence-in-depth: if an anon key ever
-- leaks into a browser, every one of these tables fails closed.

create extension if not exists "pgcrypto";

-- Money is BIGINT paise everywhere in this schema. Never numeric, never float.
-- A rupee value of 1234.56 is stored as 123456.

create table blocks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z]$'),
  name        text not null,
  created_at  timestamptz not null default now()
);

comment on table blocks is 'Physical blocks. Sapthami Heights has A and B.';

create table flats (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references blocks(id) on delete restrict,
  -- Floor is text, not int: block A starts at ground ('G') and block B has a
  -- penthouse ('PH'). Forcing these into an integer would lose the distinction.
  floor       text not null check (floor in ('G', '1', '2', '3', '4', 'PH')),
  number      text not null unique,
  flat_type   text not null check (flat_type in ('2BHK', '3BHK', 'penthouse')),
  area_sqft   integer check (area_sqft is null or area_sqft > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index flats_block_idx on flats (block_id);
comment on column flats.number is 'Nameplate identifier, e.g. A-G01, B-404, B-PH01.';

create table residents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  -- Normalised to 10 digits on write (see normalise_phone). The resident login gate
  -- compares against this, so a stray space or +91 must never cause a false reject.
  phone       text not null check (phone ~ '^[0-9]{10}$'),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index residents_phone_idx on residents (phone);

create table flat_residents (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references flats(id) on delete restrict,
  resident_id  uuid not null references residents(id) on delete restrict,
  role         text not null check (role in ('owner', 'tenant')),
  is_primary   boolean not null default false,
  from_date    date not null,
  to_date      date,
  created_at   timestamptz not null default now(),
  check (to_date is null or to_date >= from_date)
);

create index flat_residents_flat_idx on flat_residents (flat_id);
create index flat_residents_resident_idx on flat_residents (resident_id);

-- Exactly one primary contact per flat at a time. The resident login gate resolves
-- a flat to its current occupants, so an ambiguous primary would make "who can log
-- into this flat" undefined.
create unique index flat_residents_one_primary_current
  on flat_residents (flat_id)
  where to_date is null and is_primary;

comment on column flat_residents.to_date is 'NULL means currently resident. Tenancy history is kept, never deleted.';

create table committee_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  resident_id  uuid references residents(id) on delete set null,
  role         text not null check (role in ('president', 'secretary', 'treasurer', 'member')),
  from_date    date not null default current_date,
  to_date      date,
  created_at   timestamptz not null default now(),
  check (to_date is null or to_date >= from_date)
);

create index committee_members_user_idx on committee_members (user_id);

-- One active committee seat per user. Prevents a user holding two roles at once,
-- which would make "what can this person do" ambiguous at authorisation time.
create unique index committee_members_one_active_per_user
  on committee_members (user_id)
  where to_date is null;

comment on table committee_members is
  'Maps a Supabase auth user to a committee role. Server actions re-check this on every mutation; a client-sent role is never trusted.';

-- Strip +91 / 0 prefixes and any punctuation down to the 10 national digits.
-- Committee members enter phone numbers by hand from a WhatsApp group, so the
-- stored form must be canonical or the login gate will reject valid residents.
create or replace function normalise_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null then
    return null;
  end if;

  digits := regexp_replace(raw, '[^0-9]', '', 'g');

  if length(digits) = 12 and digits like '91%' then
    digits := substring(digits from 3);
  elsif length(digits) = 11 and digits like '0%' then
    digits := substring(digits from 2);
  end if;

  if digits !~ '^[0-9]{10}$' then
    raise exception 'phone number % is not a valid 10-digit Indian mobile number', raw
      using errcode = 'check_violation';
  end if;

  return digits;
end;
$$;

create or replace function residents_normalise_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := normalise_phone(new.phone);
  new.updated_at := now();
  return new;
end;
$$;

create trigger residents_normalise_phone_trg
  before insert or update on residents
  for each row execute function residents_normalise_phone();
