-- Migration: 20260727000100_reset_test_data.sql
-- Function to allow Admin to reset all test data and ledger history cleanly for committee takeover.

create or replace function reset_all_test_data()
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Unlink FKs on operational tables
  update payments set journal_entry_id = null;
  update expenses set journal_entry_id = null;
  update invoices set journal_entry_id = null;

  -- 2. Delete operational data
  delete from payment_allocations;
  delete from payments;
  delete from expenses;
  delete from water_meter_readings;
  delete from water_purchases;
  delete from water_period_summary;
  delete from invoice_lines;
  delete from invoices;
  delete from billing_periods;

  -- 3. Temporarily disable immutability triggers on ledger tables
  alter table journal_entries disable trigger journal_entries_immutable_trg;
  alter table journal_entries disable trigger journal_entries_frozen_trg;
  alter table journal_lines disable trigger journal_lines_immutable_trg;

  -- 4. Unlink self-referencing reversal links and delete ledger history
  update journal_entries set reverses_entry_id = null, reversed_by_entry_id = null;
  delete from journal_lines;
  delete from journal_entries;

  -- 5. Re-enable immutability triggers
  alter table journal_entries enable trigger journal_entries_immutable_trg;
  alter table journal_entries enable trigger journal_entries_frozen_trg;
  alter table journal_lines enable trigger journal_lines_immutable_trg;
end;
$$;

grant execute on function reset_all_test_data() to service_role;
