-- Double-entry ledger.
--
-- Double-entry is the statutory basis for housing society audits in India, but the
-- reason it is here is narrower: it gives one arithmetic invariant — debits equal
-- credits — that makes every downstream balance either provably right or loudly
-- broken. There is no quiet middle.
--
-- Two rules are enforced by the database rather than by application code, because
-- application code is exactly what will be rewritten by someone in two years who
-- does not know these rules exist:
--   1. Every journal entry balances.
--   2. Posted entries are immutable. Corrections are reversals, never edits.

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  type        text not null check (type in ('asset', 'liability', 'income', 'expense', 'equity')),
  -- Which side increases this account. Assets/expenses are debit-normal;
  -- liabilities/income/equity are credit-normal. Used by reporting to render
  -- balances with the sign a human expects.
  normal_side text not null check (normal_side in ('debit', 'credit')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table accounts is 'Chart of accounts. Seeded in 20260717000700_seed.sql.';

create table journal_entries (
  id                  uuid primary key default gen_random_uuid(),
  entry_date          date not null,
  narration           text not null check (length(trim(narration)) > 0),
  -- What caused this entry. Lets us trace any ledger line back to the invoice,
  -- payment or expense a resident is asking about.
  source_type         text not null check (source_type in ('invoice', 'payment', 'expense', 'water_purchase', 'manual', 'reversal')),
  source_id           uuid,
  reverses_entry_id   uuid references journal_entries(id) on delete restrict,
  reversed_by_entry_id uuid references journal_entries(id) on delete restrict,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index journal_entries_date_idx on journal_entries (entry_date);
create index journal_entries_source_idx on journal_entries (source_type, source_id);

-- An entry can only be reversed once. Without this, a double reversal would
-- silently double-count the correction.
create unique index journal_entries_one_reversal
  on journal_entries (reverses_entry_id)
  where reverses_entry_id is not null;

create table journal_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references journal_entries(id) on delete restrict,
  account_id   uuid not null references accounts(id) on delete restrict,
  debit_paise  bigint not null default 0 check (debit_paise >= 0),
  credit_paise bigint not null default 0 check (credit_paise >= 0),
  -- Receivable subledger: which flat this line belongs to, when it belongs to one.
  -- This is what makes "what does flat A-302 owe" answerable from the ledger alone.
  flat_id      uuid references flats(id) on delete restrict,
  created_at   timestamptz not null default now(),
  -- A line is one side or the other, never both and never neither.
  constraint journal_lines_one_sided check (
    (debit_paise > 0 and credit_paise = 0) or
    (credit_paise > 0 and debit_paise = 0)
  )
);

create index journal_lines_entry_idx on journal_lines (entry_id);
create index journal_lines_account_idx on journal_lines (account_id);
create index journal_lines_flat_idx on journal_lines (flat_id) where flat_id is not null;

-- Invariant 1: every entry balances.
--
-- This is a CONSTRAINT TRIGGER that is DEFERRABLE INITIALLY DEFERRED, and that
-- detail is the whole point. An entry is written as a header plus two or more
-- lines; it is unbalanced in between. Checking immediately would reject every
-- legitimate insert. Deferring to COMMIT means the check runs once, when the
-- transaction claims to be finished — so a half-written entry can never commit,
-- and a balanced one is never obstructed.
create or replace function assert_entry_balances()
returns trigger
language plpgsql
as $$
declare
  target_entry uuid := coalesce(new.entry_id, old.entry_id);
  total_debit  bigint;
  total_credit bigint;
  line_count   integer;
begin
  select coalesce(sum(debit_paise), 0), coalesce(sum(credit_paise), 0), count(*)
    into total_debit, total_credit, line_count
    from journal_lines
   where entry_id = target_entry;

  -- The entry header may have been rolled back with its lines; nothing to check.
  if line_count = 0 then
    return null;
  end if;

  if total_debit <> total_credit then
    raise exception
      'journal entry % does not balance: debits % paise, credits % paise',
      target_entry, total_debit, total_credit
      using errcode = 'check_violation',
            hint = 'Every entry must debit and credit the same total. This is not a rounding tolerance — it must be exact.';
  end if;

  if total_debit = 0 then
    raise exception 'journal entry % has no value', target_entry
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger journal_lines_balance_trg
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function assert_entry_balances();

-- Invariant 2: posted entries are immutable.
--
-- REVOKE alone would not achieve this: the service-role key this app runs under is
-- a superuser-ish role that bypasses grants and RLS entirely. A trigger refuses
-- everyone, including us. Editing history is not a privilege the treasurer should
-- have, and it is not one a future bug should be able to exercise by accident.
create or replace function refuse_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'the ledger is append-only: % on % is not permitted', tg_op, tg_table_name
    using errcode = 'insufficient_privilege',
          hint = 'To correct a posted entry, reverse it with reverse_journal_entry() and post a fresh one. The original must remain visible to auditors.';
end;
$$;

create trigger journal_entries_immutable_trg
  before delete on journal_entries
  for each row execute function refuse_ledger_mutation();

create trigger journal_lines_immutable_trg
  before update or delete on journal_lines
  for each row execute function refuse_ledger_mutation();

-- journal_entries UPDATE is allowed only to stamp reversed_by_entry_id. Everything
-- else about a posted entry is frozen.
create or replace function refuse_entry_edit()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.entry_date is distinct from old.entry_date
     or new.narration is distinct from old.narration
     or new.source_type is distinct from old.source_type
     or new.source_id is distinct from old.source_id
     or new.reverses_entry_id is distinct from old.reverses_entry_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'posted journal entries cannot be edited (entry %)', old.id
      using errcode = 'insufficient_privilege',
            hint = 'Only reversed_by_entry_id may be set after posting. Use reverse_journal_entry().';
  end if;
  return new;
end;
$$;

create trigger journal_entries_frozen_trg
  before update on journal_entries
  for each row execute function refuse_entry_edit();

-- Post a balanced entry in one call. Lines arrive as jsonb:
--   [{"account_code":"1100","debit_paise":50000,"flat_id":"..."}, ...]
create or replace function post_journal_entry(
  p_entry_date  date,
  p_narration   text,
  p_source_type text,
  p_source_id   uuid,
  p_lines       jsonb,
  p_created_by  uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_line     jsonb;
  v_account  uuid;
begin
  if jsonb_array_length(p_lines) < 2 then
    raise exception 'a journal entry needs at least two lines, got %', jsonb_array_length(p_lines)
      using errcode = 'check_violation';
  end if;

  insert into journal_entries (entry_date, narration, source_type, source_id, created_by)
  values (p_entry_date, p_narration, p_source_type, p_source_id, p_created_by)
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select id into v_account from accounts where code = v_line->>'account_code';
    if v_account is null then
      raise exception 'unknown account code %', v_line->>'account_code'
        using errcode = 'foreign_key_violation';
    end if;

    insert into journal_lines (entry_id, account_id, debit_paise, credit_paise, flat_id)
    values (
      v_entry_id,
      v_account,
      coalesce((v_line->>'debit_paise')::bigint, 0),
      coalesce((v_line->>'credit_paise')::bigint, 0),
      nullif(v_line->>'flat_id', '')::uuid
    );
  end loop;

  -- The balance check fires at COMMIT, not here.
  return v_entry_id;
end;
$$;

-- Correct a posted entry by mirroring it: every debit becomes a credit and back.
-- The original stays exactly where it was, which is the point — an auditor sees
-- both the mistake and the fix, not a tidied-up history.
create or replace function reverse_journal_entry(
  p_entry_id   uuid,
  p_reason     text,
  p_created_by uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_original journal_entries%rowtype;
  v_new_id   uuid;
begin
  select * into v_original from journal_entries where id = p_entry_id;
  if not found then
    raise exception 'journal entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  if v_original.reversed_by_entry_id is not null then
    raise exception 'journal entry % has already been reversed by %', p_entry_id, v_original.reversed_by_entry_id
      using errcode = 'check_violation';
  end if;

  insert into journal_entries (entry_date, narration, source_type, source_id, reverses_entry_id, created_by)
  values (current_date, p_reason, 'reversal', v_original.source_id, p_entry_id, p_created_by)
  returning id into v_new_id;

  insert into journal_lines (entry_id, account_id, debit_paise, credit_paise, flat_id)
  select v_new_id, account_id, credit_paise, debit_paise, flat_id
    from journal_lines
   where entry_id = p_entry_id;

  update journal_entries set reversed_by_entry_id = v_new_id where id = p_entry_id;

  return v_new_id;
end;
$$;

-- Reconciliation views. These are living assertions, surfaced on the committee's
-- Books screen: if either ever returns a non-zero variance, the books are wrong and
-- somebody needs to know today rather than at the AGM.

create view trial_balance as
select
  a.code,
  a.name,
  a.type,
  a.normal_side,
  coalesce(sum(l.debit_paise), 0)  as debit_paise,
  coalesce(sum(l.credit_paise), 0) as credit_paise,
  case a.normal_side
    when 'debit'  then coalesce(sum(l.debit_paise), 0) - coalesce(sum(l.credit_paise), 0)
    else               coalesce(sum(l.credit_paise), 0) - coalesce(sum(l.debit_paise), 0)
  end as balance_paise
from accounts a
left join journal_lines l on l.account_id = a.id
group by a.id, a.code, a.name, a.type, a.normal_side;

comment on view trial_balance is 'Per-account balances. SUM(debit_paise) must equal SUM(credit_paise) across all rows.';

create view ledger_health as
select
  (select coalesce(sum(debit_paise), 0) from journal_lines)  as total_debit_paise,
  (select coalesce(sum(credit_paise), 0) from journal_lines) as total_credit_paise,
  (select coalesce(sum(debit_paise), 0) - coalesce(sum(credit_paise), 0) from journal_lines) as variance_paise,
  (select count(*) from journal_entries e
    where (select coalesce(sum(debit_paise), 0) from journal_lines where entry_id = e.id)
       <> (select coalesce(sum(credit_paise), 0) from journal_lines where entry_id = e.id)
  ) as unbalanced_entry_count;

comment on view ledger_health is 'variance_paise and unbalanced_entry_count must both be zero. Anything else is a bug, not a rounding artefact.';
