-- Billing: periods, invoices, payments.
--
-- The billing period is the freeze point. While it is 'open' the committee can edit
-- readings and bills freely; once 'closed' the numbers are snapshotted and the
-- ledger has been posted. A closed period is history and does not move.

create table billing_periods (
  id                     uuid primary key default gen_random_uuid(),
  year                   integer not null check (year between 2020 and 2100),
  month                  integer not null check (month between 1 and 12),
  status                 text not null default 'open' check (status in ('open', 'closed')),
  -- Flat maintenance rate, identical for every flat (committee decision).
  -- Captured per period so that raising the rate never rewrites old invoices.
  maintenance_paise      bigint not null check (maintenance_paise >= 0),
  sinking_fund_paise     bigint not null default 0 check (sinking_fund_paise >= 0),
  due_date               date,
  closed_at              timestamptz,
  closed_by              uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  unique (year, month),
  constraint closed_periods_have_closed_at check (
    (status = 'open' and closed_at is null) or (status = 'closed' and closed_at is not null)
  )
);

comment on column billing_periods.maintenance_paise is
  'The flat maintenance charge for this period, frozen at creation. Rate changes apply to future periods only.';

create table invoices (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null references flats(id) on delete restrict,
  period_id   uuid not null references billing_periods(id) on delete restrict,
  invoice_no  text not null unique,
  total_paise bigint not null check (total_paise >= 0),
  issued_on   date not null,
  -- Voided when a closed period is reopened. Invoices are never deleted: the ledger
  -- is append-only and its entries reference invoices via source_id, so deleting one
  -- would leave a posted entry pointing at nothing — destroying the audit trail at
  -- exactly the moment somebody is trying to follow it.
  voided_at   timestamptz,
  void_reason text,
  created_at  timestamptz not null default now()
);

create index invoices_flat_idx on invoices (flat_id);
create index invoices_period_idx on invoices (period_id);

-- One LIVE invoice per flat per period. Voided ones stay on file and do not block
-- a re-close after corrections.
create unique index invoices_one_live_per_flat_period
  on invoices (flat_id, period_id)
  where voided_at is null;

create table invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  kind        text not null check (kind in ('maintenance', 'water', 'sinking_fund', 'penalty', 'adjustment', 'other')),
  description text not null,
  -- For water: litres consumed. Lets the resident see qty x rate = amount and
  -- check the arithmetic themselves rather than take it on trust.
  qty         numeric(14, 3),
  unit_rate   numeric(18, 6),
  amount_paise bigint not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index invoice_lines_invoice_idx on invoice_lines (invoice_id);

-- An invoice total must equal the sum of its lines. Deferred for the same reason the
-- ledger's balance check is: the invoice header is inserted before its lines exist.
create or replace function assert_invoice_total()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total   bigint;
  v_stated  bigint;
begin
  select coalesce(sum(amount_paise), 0) into v_total from invoice_lines where invoice_id = v_invoice;
  select total_paise into v_stated from invoices where id = v_invoice;

  if v_stated is null then
    return null; -- invoice rolled back with its lines
  end if;

  if v_total <> v_stated then
    raise exception 'invoice % states % paise but its lines sum to % paise', v_invoice, v_stated, v_total
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger invoice_lines_total_trg
  after insert or update or delete on invoice_lines
  deferrable initially deferred
  for each row execute function assert_invoice_total();

-- Payments record money that arrived outside this app — UPI, bank transfer, cash,
-- cheque. Nothing here moves money; it records that the committee saw it.
create table payments (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references flats(id) on delete restrict,
  paid_on      date not null,
  amount_paise bigint not null check (amount_paise > 0),
  mode         text not null check (mode in ('upi', 'bank', 'cash', 'cheque')),
  reference    text,
  -- 'recorded' = committee has entered it; 'verified' = seen in the bank statement.
  -- Only verified payments post to the ledger — an unverified UPI reference is a
  -- claim, not yet money.
  status       text not null default 'recorded' check (status in ('recorded', 'verified', 'bounced')),
  received_by  uuid references auth.users(id) on delete set null,
  notes        text,
  journal_entry_id uuid references journal_entries(id) on delete restrict,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index payments_flat_idx on payments (flat_id);
create index payments_paid_on_idx on payments (paid_on);

-- A UPI/bank reference is the bank's idempotency key. Recording it twice is the
-- most likely data-entry error and would inflate collections; the database refuses.
create unique index payments_unique_reference
  on payments (mode, reference)
  where reference is not null and status <> 'bounced';

create table payment_allocations (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references payments(id) on delete cascade,
  invoice_id   uuid not null references invoices(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  created_at   timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create index payment_allocations_invoice_idx on payment_allocations (invoice_id);

-- A payment cannot be allocated to more than it is worth. The remainder is an
-- advance, which is legitimate and stays unallocated until the next invoice.
create or replace function assert_allocation_within_payment()
returns trigger
language plpgsql
as $$
declare
  v_payment uuid := coalesce(new.payment_id, old.payment_id);
  v_allocated bigint;
  v_amount    bigint;
begin
  select coalesce(sum(amount_paise), 0) into v_allocated from payment_allocations where payment_id = v_payment;
  select amount_paise into v_amount from payments where id = v_payment;

  if v_amount is null then
    return null;
  end if;

  if v_allocated > v_amount then
    raise exception 'payment % is % paise but % paise has been allocated from it', v_payment, v_amount, v_allocated
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger payment_allocations_within_payment_trg
  after insert or update or delete on payment_allocations
  deferrable initially deferred
  for each row execute function assert_allocation_within_payment();

-- An invoice cannot be over-paid via allocations either.
create or replace function assert_allocation_within_invoice()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_allocated bigint;
  v_total     bigint;
begin
  select coalesce(sum(amount_paise), 0) into v_allocated from payment_allocations where invoice_id = v_invoice;
  select total_paise into v_total from invoices where id = v_invoice;

  if v_total is null then
    return null;
  end if;

  if v_allocated > v_total then
    raise exception 'invoice % totals % paise but % paise has been allocated to it', v_invoice, v_total, v_allocated
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger payment_allocations_within_invoice_trg
  after insert or update or delete on payment_allocations
  deferrable initially deferred
  for each row execute function assert_allocation_within_invoice();

create table expenses (
  id                  uuid primary key default gen_random_uuid(),
  period_id           uuid references billing_periods(id) on delete restrict,
  category_account_id uuid not null references accounts(id) on delete restrict,
  vendor              text,
  description         text not null,
  amount_paise        bigint not null check (amount_paise > 0),
  spent_on            date not null,
  paid_from           text not null default 'bank' check (paid_from in ('bank', 'cash')),
  bill_ref            text,
  receipt_path        text,
  issue_id            uuid,
  journal_entry_id    uuid references journal_entries(id) on delete restrict,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index expenses_period_idx on expenses (period_id);
create index expenses_spent_on_idx on expenses (spent_on);

-- What each flat owes, derived from the ledger's receivable subledger rather than
-- from invoices minus payments. Deriving it from the ledger means this view and the
-- books cannot disagree — there is only one source of truth.
-- The join must restrict the LINES to the receivable account, not merely null out
-- the account column. Writing this as `left join accounts ... and a.code = '1100'`
-- would still sum every flat-scoped line regardless of account.
create view flat_balances as
select
  f.id as flat_id,
  f.number,
  coalesce(sum(l.debit_paise), 0)  as billed_paise,
  coalesce(sum(l.credit_paise), 0) as paid_paise,
  coalesce(sum(l.debit_paise), 0) - coalesce(sum(l.credit_paise), 0) as balance_paise
from flats f
left join journal_lines l
  on l.flat_id = f.id
 and l.account_id = (select id from accounts where code = '1100')
where f.is_active
group by f.id, f.number;

comment on view flat_balances is
  'Positive balance_paise = the flat owes the society. Negative = the flat is in advance.';

-- The reconciliation that catches drift between the ledger and the operational
-- tables. Both sides are computed independently and must agree exactly.
create view flat_balance_check as
select
  f.id as flat_id,
  f.number,
  coalesce((
    select sum(i.total_paise) from invoices i where i.flat_id = f.id and i.voided_at is null
  ), 0) as invoiced_paise,
  coalesce((
    select sum(p.amount_paise) from payments p where p.flat_id = f.id and p.status = 'verified'
  ), 0) as verified_paid_paise,
  coalesce((
    select sum(l.debit_paise) - sum(l.credit_paise)
      from journal_lines l
      join accounts a on a.id = l.account_id
     where l.flat_id = f.id and a.code = '1100'
  ), 0) as ledger_balance_paise,
  coalesce((
    select sum(i.total_paise) from invoices i where i.flat_id = f.id and i.voided_at is null
  ), 0)
  - coalesce((
    select sum(p.amount_paise) from payments p where p.flat_id = f.id and p.status = 'verified'
  ), 0)
  - coalesce((
    select sum(l.debit_paise) - sum(l.credit_paise)
      from journal_lines l
      join accounts a on a.id = l.account_id
     where l.flat_id = f.id and a.code = '1100'
  ), 0) as variance_paise
from flats f
where f.is_active;

comment on view flat_balance_check is
  'variance_paise must be zero for every flat. Non-zero means the ledger and the invoice/payment tables have diverged.';
