-- Water: purchases, meter readings, and the frozen per-period summary.
--
-- Sapthami Heights buys water from two sources into a common sump — the Manjeera
-- municipal connection and private tankers at a markedly higher rate per litre.
-- Flats draw the mixture, so each period has one blended rate.
--
-- The allocation arithmetic lives in src/lib/water/allocate.ts, not here. That is a
-- deliberate split: the math is exact-integer TypeScript with a 2000-case fuzz test
-- behind it, which is not something plpgsql would give us without a local Postgres.
-- What this schema does is refuse to store a result that fails the invariant — see
-- close_billing_period(). The database does not compute the numbers; it declines to
-- believe wrong ones.

create table water_purchases (
  id           uuid primary key default gen_random_uuid(),
  period_id    uuid not null references billing_periods(id) on delete restrict,
  source_type  text not null check (source_type in ('manjeera', 'tanker')),
  purchased_on date not null,
  litres       bigint not null check (litres > 0),
  amount_paise bigint not null check (amount_paise >= 0),
  vendor       text,
  bill_ref     text,
  receipt_path text,
  notes        text,
  journal_entry_id uuid references journal_entries(id) on delete restrict,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index water_purchases_period_idx on water_purchases (period_id);

comment on table water_purchases is
  'Every tanker delivery and every Manjeera bill. One row per delivery — tankers are not aggregated, so the committee can show residents each individual bill.';

create table water_meter_readings (
  id            uuid primary key default gen_random_uuid(),
  flat_id       uuid not null references flats(id) on delete restrict,
  period_id     uuid not null references billing_periods(id) on delete restrict,
  read_on       date not null,
  -- The cumulative number on the meter face, as read.
  reading_value bigint not null check (reading_value >= 0),
  -- Consumption for the period. Normally derived as reading_value minus the prior
  -- period's, but stored rather than derived because it is frozen into the invoice
  -- at close: a later correction to an old reading must never silently restate a
  -- closed month's bill.
  consumption_litres bigint not null check (consumption_litres >= 0),
  -- True when the meter was replaced or rolled over, so consumption cannot be
  -- derived by subtraction and was entered directly.
  meter_reset   boolean not null default false,
  -- True when the meter could not be read and consumption was estimated. Surfaced
  -- on the invoice: a resident is entitled to know their bill was not measured.
  is_estimated  boolean not null default false,
  notes         text,
  recorded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (flat_id, period_id)
);

create index water_meter_readings_period_idx on water_meter_readings (period_id);

-- The snapshot. Written once, at close, and never recomputed.
--
-- This table is the reason editing a tanker bill from March does not silently
-- change March's invoices. The rate that was actually billed is recorded here as a
-- historical fact, independent of the rows it was derived from.
create table water_period_summary (
  period_id             uuid primary key references billing_periods(id) on delete restrict,
  total_cost_paise      bigint not null check (total_cost_paise >= 0),
  purchased_litres      bigint not null check (purchased_litres >= 0),
  metered_litres        bigint not null check (metered_litres >= 0),
  loss_litres           bigint not null,
  loss_pct              numeric(9, 4) not null,
  blended_rate_paise_per_litre numeric(18, 6) not null,
  manjeera_litres       bigint not null default 0,
  manjeera_cost_paise   bigint not null default 0,
  tanker_litres         bigint not null default 0,
  tanker_cost_paise     bigint not null default 0,
  estimated_reading_count integer not null default 0,
  snapshotted_at        timestamptz not null default now(),
  constraint loss_is_consistent check (loss_litres = purchased_litres - metered_litres)
);

comment on table water_period_summary is
  'Frozen at period close. Never updated. If a purchase is corrected after close, the period must be reopened via reversal, which writes a new summary.';

comment on column water_period_summary.loss_litres is
  'purchased - metered. Negative means meters recorded more than was bought, which indicates a faulty meter or a misread, not a windfall.';

-- The resident-facing derivation, joined up so the "My Water" screen can show the
-- whole chain: what the society bought, at what rates, what the meters said, and
-- how that became this flat's line on this invoice.
create view water_period_transparency as
select
  bp.id as period_id,
  bp.year,
  bp.month,
  bp.status,
  s.total_cost_paise,
  s.purchased_litres,
  s.metered_litres,
  s.loss_litres,
  s.loss_pct,
  s.blended_rate_paise_per_litre,
  s.manjeera_litres,
  s.manjeera_cost_paise,
  case when s.manjeera_litres > 0
       then round(s.manjeera_cost_paise::numeric / s.manjeera_litres, 6) end as manjeera_rate_paise_per_litre,
  s.tanker_litres,
  s.tanker_cost_paise,
  case when s.tanker_litres > 0
       then round(s.tanker_cost_paise::numeric / s.tanker_litres, 6) end as tanker_rate_paise_per_litre,
  s.estimated_reading_count,
  (select count(*) from water_purchases wp where wp.period_id = bp.id and wp.source_type = 'tanker') as tanker_delivery_count
from billing_periods bp
join water_period_summary s on s.period_id = bp.id;
