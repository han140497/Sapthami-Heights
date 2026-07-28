-- Migration: 20260728000200_fix_reset_where.sql
-- Fix reset_all_test_data function to include WHERE clauses on all UPDATE and DELETE statements.

create or replace function reset_all_test_data()
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Unlink FKs on operational tables
  update payments set journal_entry_id = null where journal_entry_id is not null;
  update expenses set journal_entry_id = null where journal_entry_id is not null;
  update invoices set journal_entry_id = null where journal_entry_id is not null;

  -- 2. Delete operational data
  delete from payment_allocations where true;
  delete from payments where true;
  delete from expenses where true;
  delete from water_meter_readings where true;
  delete from water_purchases where true;
  delete from water_period_summary where true;
  delete from invoice_lines where true;
  delete from invoices where true;
  delete from billing_periods where true;

  -- 3. Temporarily disable immutability triggers on ledger tables
  alter table journal_entries disable trigger journal_entries_immutable_trg;
  alter table journal_entries disable trigger journal_entries_frozen_trg;
  alter table journal_lines disable trigger journal_lines_immutable_trg;

  -- 4. Unlink self-referencing reversal links and delete ledger history
  update journal_entries set reverses_entry_id = null, reversed_by_entry_id = null where reverses_entry_id is not null or reversed_by_entry_id is not null;
  delete from journal_lines where true;
  delete from journal_entries where true;

  -- 5. Re-enable immutability triggers
  alter table journal_entries enable trigger journal_entries_immutable_trg;
  alter table journal_entries enable trigger journal_entries_frozen_trg;
  alter table journal_lines enable trigger journal_lines_immutable_trg;
end;
$$;

grant execute on function reset_all_test_data() to service_role;
