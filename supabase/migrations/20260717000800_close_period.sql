-- close_billing_period: the transactional freeze point.
--
-- Closing a month does four things that must all happen or none of them:
--   1. snapshot the water summary,
--   2. generate one invoice per active flat,
--   3. post the receivable side of the ledger,
--   4. mark the period closed.
--
-- Half of that is worse than none. A period with invoices but no ledger entries
-- would show residents dues that the books do not know about. So it is one function,
-- one transaction, and it either lands whole or leaves the month untouched.
--
-- The water figures are computed by src/lib/water/allocate.ts and passed in as
-- p_water. This function does not trust them: it re-checks that the per-flat
-- allocations sum to the total water cost exactly before writing anything. The math
-- lives in TypeScript because that is where it can be fuzz-tested; the veto lives
-- here because this is the last point before the numbers become history.

create or replace function close_billing_period(
  p_period_id  uuid,
  p_water      jsonb,
  p_closed_by  uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_period        billing_periods%rowtype;
  v_flat          record;
  v_invoice_id    uuid;
  v_invoice_no    text;
  v_water_paise   bigint;
  v_water_litres  bigint;
  v_total         bigint;
  v_seq           integer := 0;
  v_lines         jsonb;
  v_entry_id      uuid;
  v_alloc_total   bigint := 0;
  v_stated_cost   bigint;
  v_invoice_count integer := 0;
  v_grand_total   bigint := 0;
  v_is_estimated  boolean;
  v_revision      integer;
  v_suffix        text;
begin
  select * into v_period from billing_periods where id = p_period_id for update;
  if not found then
    raise exception 'billing period % not found', p_period_id using errcode = 'no_data_found';
  end if;

  if v_period.status = 'closed' then
    raise exception 'billing period %-% is already closed', v_period.year, v_period.month
      using errcode = 'check_violation',
            hint = 'Reopening a closed period means reversing its ledger entries, not editing them.';
  end if;

  v_stated_cost := coalesce((p_water->>'totalCostPaise')::bigint, 0);

  -- Veto 1: the allocation must sum to the water bill exactly. Not approximately.
  select coalesce(sum((a->>'amountPaise')::bigint), 0)
    into v_alloc_total
    from jsonb_array_elements(coalesce(p_water->'allocations', '[]'::jsonb)) a;

  if v_alloc_total <> v_stated_cost then
    raise exception
      'water allocation does not reconcile: allocations sum to % paise but the period''s water cost is % paise',
      v_alloc_total, v_stated_cost
      using errcode = 'check_violation',
            hint = 'computeWaterPeriod() guarantees these are equal. A mismatch here means the payload was tampered with or the wrong period was passed.';
  end if;

  -- Veto 2: the stated water cost must match the purchases actually on file.
  -- Catches a stale payload computed before a tanker bill was added.
  if v_stated_cost <> coalesce((select sum(amount_paise) from water_purchases where period_id = p_period_id), 0) then
    raise exception
      'water payload is stale: it states % paise but recorded purchases total % paise',
      v_stated_cost,
      coalesce((select sum(amount_paise) from water_purchases where period_id = p_period_id), 0)
      using errcode = 'check_violation',
            hint = 'Recompute from the current purchases and retry the close.';
  end if;

  -- Veto 3: every active flat must have a reading. Closing with a flat missing
  -- would divide the water cost across 31 flats and quietly overcharge them.
  if exists (
    select 1 from flats f
     where f.is_active
       and not exists (
         select 1 from water_meter_readings r
          where r.flat_id = f.id and r.period_id = p_period_id
       )
  ) and v_stated_cost > 0 then
    raise exception 'cannot close: % active flat(s) have no meter reading for this period',
      (select count(*) from flats f where f.is_active and not exists (
        select 1 from water_meter_readings r where r.flat_id = f.id and r.period_id = p_period_id));
  end if;

  -- 1. Snapshot the water summary. Written once; never recomputed.
  insert into water_period_summary (
    period_id, total_cost_paise, purchased_litres, metered_litres, loss_litres, loss_pct,
    blended_rate_paise_per_litre, manjeera_litres, manjeera_cost_paise,
    tanker_litres, tanker_cost_paise, estimated_reading_count
  )
  values (
    p_period_id,
    v_stated_cost,
    coalesce((p_water->>'purchasedLitres')::bigint, 0),
    coalesce((p_water->>'meteredLitres')::bigint, 0),
    coalesce((p_water->>'lossLitres')::bigint, 0),
    coalesce((p_water->>'lossPct')::numeric, 0),
    coalesce((p_water->>'blendedRatePaisePerLitre')::numeric, 0),
    coalesce((select sum(litres) from water_purchases where period_id = p_period_id and source_type = 'manjeera'), 0),
    coalesce((select sum(amount_paise) from water_purchases where period_id = p_period_id and source_type = 'manjeera'), 0),
    coalesce((select sum(litres) from water_purchases where period_id = p_period_id and source_type = 'tanker'), 0),
    coalesce((select sum(amount_paise) from water_purchases where period_id = p_period_id and source_type = 'tanker'), 0),
    coalesce((select count(*) from water_meter_readings where period_id = p_period_id and is_estimated), 0)
  );

  -- If this period was closed and reopened before, its old invoices are voided but
  -- still on file. Invoice numbers are globally unique, so a re-close must not reuse
  -- them — the revision suffix keeps the new set distinct and makes it obvious to
  -- anyone reading a statement that the month was re-billed.
  select count(*) into v_revision
    from invoices where period_id = p_period_id and voided_at is not null;
  v_suffix := case when v_revision > 0 then format('-R%s', (v_revision / greatest(
                (select count(*) from flats where is_active), 1)) + 1) else '' end;

  -- 2 & 3. One invoice per active flat, and the matching ledger entry.
  for v_flat in
    select f.id, f.number from flats f where f.is_active order by f.number
  loop
    v_seq := v_seq + 1;
    v_invoice_no := format('SH/%s-%s/%s%s', v_period.year, lpad(v_period.month::text, 2, '0'), lpad(v_seq::text, 3, '0'), v_suffix);

    select coalesce((a->>'amountPaise')::bigint, 0)
      into v_water_paise
      from jsonb_array_elements(coalesce(p_water->'allocations', '[]'::jsonb)) a
     where a->>'flatId' = v_flat.id::text;
    v_water_paise := coalesce(v_water_paise, 0);

    select coalesce(consumption_litres, 0), coalesce(is_estimated, false)
      into v_water_litres, v_is_estimated
      from water_meter_readings
     where flat_id = v_flat.id and period_id = p_period_id;
    v_water_litres := coalesce(v_water_litres, 0);
    v_is_estimated := coalesce(v_is_estimated, false);

    v_total := v_period.maintenance_paise + v_period.sinking_fund_paise + v_water_paise;

    insert into invoices (flat_id, period_id, invoice_no, total_paise, issued_on)
    values (v_flat.id, p_period_id, v_invoice_no, v_total, current_date)
    returning id into v_invoice_id;

    insert into invoice_lines (invoice_id, kind, description, amount_paise)
    values (v_invoice_id, 'maintenance',
            format('Monthly maintenance — %s/%s', lpad(v_period.month::text, 2, '0'), v_period.year),
            v_period.maintenance_paise);

    if v_period.sinking_fund_paise > 0 then
      insert into invoice_lines (invoice_id, kind, description, amount_paise)
      values (v_invoice_id, 'sinking_fund', 'Corpus fund contribution', v_period.sinking_fund_paise);
    end if;

    -- The water line carries qty and rate so the resident can multiply it out and
    -- check us. Transparency that cannot be verified is just assertion.
    insert into invoice_lines (invoice_id, kind, description, qty, unit_rate, amount_paise, metadata)
    values (
      v_invoice_id,
      'water',
      case when v_is_estimated
           then format('Water — %s litres (ESTIMATED, meter not read) at blended rate', v_water_litres)
           else format('Water — %s litres at blended rate', v_water_litres) end,
      v_water_litres,
      coalesce((p_water->>'blendedRatePaisePerLitre')::numeric, 0),
      v_water_paise,
      jsonb_build_object(
        'is_estimated', v_is_estimated,
        'blended_rate_paise_per_litre', coalesce((p_water->>'blendedRatePaisePerLitre')::numeric, 0),
        'period_metered_litres', coalesce((p_water->>'meteredLitres')::bigint, 0),
        'period_total_cost_paise', v_stated_cost
      )
    );

    -- Receivable rises; income accounts take the credit. Water income is kept
    -- separate from maintenance income so the books show whether water recovery
    -- actually matches water spend.
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1100', 'debit_paise', v_total, 'flat_id', v_flat.id::text)
    );
    if v_period.maintenance_paise > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '4000', 'credit_paise', v_period.maintenance_paise));
    end if;
    if v_period.sinking_fund_paise > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '2000', 'credit_paise', v_period.sinking_fund_paise));
    end if;
    if v_water_paise > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '4010', 'credit_paise', v_water_paise));
    end if;

    v_entry_id := post_journal_entry(
      current_date,
      format('Invoice %s — flat %s', v_invoice_no, v_flat.number),
      'invoice',
      v_invoice_id,
      v_lines,
      p_closed_by
    );

    v_invoice_count := v_invoice_count + 1;
    v_grand_total := v_grand_total + v_total;
  end loop;

  -- 4. Freeze.
  update billing_periods
     set status = 'closed', closed_at = now(), closed_by = p_closed_by
   where id = p_period_id;

  return jsonb_build_object(
    'period_id', p_period_id,
    'invoice_count', v_invoice_count,
    'total_billed_paise', v_grand_total,
    'water_cost_paise', v_stated_cost
  );
end;
$$;

comment on function close_billing_period is
  'Closes a billing period atomically: snapshots water, raises invoices, posts the ledger. Rejects a water payload that does not reconcile exactly against recorded purchases.';

-- Reopening is a reversal, not an undo. Every ledger entry raised by the close is
-- mirrored, the invoices are removed, and the snapshot is dropped — but the original
-- entries and their reversals both remain visible in the ledger forever. Someone
-- looking at the books in a year can see the month was reopened and why.
create or replace function reopen_billing_period(
  p_period_id uuid,
  p_reason    text,
  p_actor     uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_period    billing_periods%rowtype;
  v_entry     record;
  v_reversed  integer := 0;
begin
  select * into v_period from billing_periods where id = p_period_id for update;
  if not found then
    raise exception 'billing period % not found', p_period_id using errcode = 'no_data_found';
  end if;

  if v_period.status <> 'closed' then
    raise exception 'billing period %-% is not closed', v_period.year, v_period.month
      using errcode = 'check_violation';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'a reason is required to reopen a closed period'
      using errcode = 'check_violation';
  end if;

  -- Refuse if any invoice in the period has been paid against. Unwinding an
  -- allocated payment is not something to do implicitly.
  if exists (
    select 1 from payment_allocations pa
      join invoices i on i.id = pa.invoice_id
     where i.period_id = p_period_id
  ) then
    raise exception 'cannot reopen: payments have already been allocated to invoices in this period'
      using hint = 'Reverse the payment allocations first, deliberately.';
  end if;

  for v_entry in
    select je.id from journal_entries je
      join invoices i on i.id = je.source_id
     where je.source_type = 'invoice'
       and i.period_id = p_period_id
       and je.reversed_by_entry_id is null
  loop
    perform reverse_journal_entry(v_entry.id, format('Reopen %s-%s: %s', v_period.year, v_period.month, p_reason), p_actor);
    v_reversed := v_reversed + 1;
  end loop;

  -- Void, never delete. The reversed ledger entries above still reference these
  -- invoices by source_id; deleting them would leave the audit trail pointing at
  -- nothing precisely when someone is trying to follow it.
  update invoices
     set voided_at = now(),
         void_reason = format('Period reopened: %s', p_reason)
   where period_id = p_period_id and voided_at is null;

  -- The summary is a snapshot of a close that no longer stands, so it goes. A fresh
  -- one is written by the next close; the water purchases it were derived from remain.
  delete from water_period_summary where period_id = p_period_id;

  update billing_periods
     set status = 'open', closed_at = null, closed_by = null
   where id = p_period_id;

  return jsonb_build_object('period_id', p_period_id, 'entries_reversed', v_reversed);
end;
$$;
