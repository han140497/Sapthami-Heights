-- Rate limiting for the public committee self-signup page.
--
-- Signup creates a Supabase Auth user with NO committee seat — the account can see
-- nothing until an admin approves it and assigns a role. The approval step is the
-- real gate, so a spammed signup grants zero access. But a public endpoint that
-- creates auth users still shouldn't be freely hammerable, so signups are throttled
-- per IP the same way resident logins are.

create table committee_signup_attempts (
  id       bigserial primary key,
  ip_hash  text not null,
  email    text,
  at       timestamptz not null default now()
);

create index committee_signup_attempts_ip_idx on committee_signup_attempts (ip_hash, at desc);

alter table committee_signup_attempts enable row level security;
alter table committee_signup_attempts force row level security;

-- True when this IP has signed up too many times recently.
create or replace function committee_signup_is_throttled(p_ip_hash text)
returns boolean
language sql
stable
as $$
  select (
    select count(*) from committee_signup_attempts
     where ip_hash = p_ip_hash and at > now() - interval '1 hour'
  ) >= 5;
$$;
