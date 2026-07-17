-- Row Level Security and the audit trail.
--
-- READ THIS BEFORE ADDING A POLICY.
--
-- RLS is NOT the access boundary in this app. It cannot be. Residents authenticate
-- with block + flat + phone against a server route and never receive a Supabase
-- identity, so there is no auth.uid() to scope them by and no policy that could
-- express "this resident may see this flat".
--
-- The access boundary is the Next.js server layer, which holds the service-role key
-- and scopes every query to the flat in the caller's signed cookie. The service role
-- bypasses RLS by design — that is how this app reads its own data.
--
-- What RLS does here is fail closed. Every table gets RLS enabled and NO permissive
-- policy for anon or authenticated. So if a key is ever mistakenly shipped to a
-- browser, or someone wires up the JS client directly, they get nothing rather than
-- everything. It is a backstop against our own future mistakes, not a feature.
--
-- If you find yourself adding a policy to make something work in the browser: stop.
-- Route it through the server instead.

do $$
declare
  t text;
begin
  foreach t in array array[
    'blocks', 'flats', 'residents', 'flat_residents', 'committee_members',
    'accounts', 'journal_entries', 'journal_lines',
    'billing_periods', 'invoices', 'invoice_lines',
    'payments', 'payment_allocations', 'expenses',
    'water_purchases', 'water_meter_readings', 'water_period_summary',
    'issues', 'issue_estimates', 'issue_comments', 'issue_photos'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    -- FORCE applies RLS even to the table owner, so a stray owner-context query
    -- cannot quietly bypass it. The service role still bypasses, which is intended.
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- Deliberately no policies. Deny-all is the desired state for anon and authenticated.

-- Views inherit the RLS of their underlying tables, but a view owned by a superuser
-- would run with the owner's rights. security_invoker makes them run as the caller,
-- so the deny-all above actually applies to them too.
alter view trial_balance set (security_invoker = on);
alter view ledger_health set (security_invoker = on);
alter view flat_balances set (security_invoker = on);
alter view flat_balance_check set (security_invoker = on);
alter view water_period_transparency set (security_invoker = on);
alter view issue_cost_summary set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- Audit trail
--
-- Append-only record of who changed what. For a committee handling other people's
-- money, "the app says so" is worth very little without this; an audit trail is what
-- turns a disputed figure into a checkable one.
-- ---------------------------------------------------------------------------

create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor       uuid,
  before_data jsonb,
  after_data  jsonb,
  at          timestamptz not null default now()
);

create index audit_log_table_row_idx on audit_log (table_name, row_id);
create index audit_log_at_idx on audit_log (at desc);

alter table audit_log enable row level security;
alter table audit_log force row level security;

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  -- auth.uid() is null when the service role acts without a user JWT, which is the
  -- normal case for resident-triggered writes. The server sets app.actor_id where
  -- it knows the acting committee member.
  begin
    v_actor := nullif(current_setting('app.actor_id', true), '')::uuid;
  exception when others then
    v_actor := null;
  end;

  if v_actor is null then
    begin
      v_actor := auth.uid();
    exception when others then
      v_actor := null;
    end;
  end if;

  insert into audit_log (table_name, row_id, action, actor, before_data, after_data)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'), 'unknown'),
    tg_op,
    v_actor,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

-- Audit the money and the things that decide money. Deliberately not every table:
-- an audit log nobody reads is noise, and these are the rows that get disputed.
do $$
declare
  t text;
begin
  foreach t in array array[
    'billing_periods', 'invoices', 'payments', 'payment_allocations',
    'expenses', 'water_purchases', 'water_meter_readings',
    'issue_estimates', 'committee_members', 'residents', 'flat_residents'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on %I
         for each row execute function audit_row_change()',
      t || '_audit_trg', t
    );
  end loop;
end $$;

create or replace function refuse_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_immutable_trg
  before update or delete on audit_log
  for each row execute function refuse_audit_mutation();

-- ---------------------------------------------------------------------------
-- Resident login rate limiting
--
-- The resident gate is block + flat + phone with no password. Thirty-two flats
-- against a 10-digit number is brute-forceable given time, so attempts are counted
-- and throttled. This narrows the window; it does not close it, and the phone gate
-- remains a soft gate rather than authentication.
-- ---------------------------------------------------------------------------

create table resident_login_attempts (
  id          bigserial primary key,
  flat_number text,
  ip_hash     text not null,
  succeeded   boolean not null,
  at          timestamptz not null default now()
);

create index resident_login_attempts_ip_idx on resident_login_attempts (ip_hash, at desc);
create index resident_login_attempts_flat_idx on resident_login_attempts (flat_number, at desc);

alter table resident_login_attempts enable row level security;
alter table resident_login_attempts force row level security;

-- True when this IP or this flat has failed too often recently.
create or replace function resident_login_is_throttled(p_ip_hash text, p_flat_number text)
returns boolean
language sql
stable
as $$
  select
    (select count(*) from resident_login_attempts
      where ip_hash = p_ip_hash and not succeeded and at > now() - interval '15 minutes') >= 10
    or
    (select count(*) from resident_login_attempts
      where flat_number = p_flat_number and not succeeded and at > now() - interval '15 minutes') >= 10;
$$;
