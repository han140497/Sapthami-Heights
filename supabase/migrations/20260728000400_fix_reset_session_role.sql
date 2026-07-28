-- Migration: 20260728000400_fix_reset_session_role.sql
-- Use session_replication_role = 'replica' to bypass immutability triggers cleanly without DDL ALTER TABLE statements.

create or replace function reset_all_test_data()
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Temporarily bypass all user-defined triggers for this transaction
  set local session_replication_role = 'replica';

  -- 2. Unlink self-referencing and foreign key relationships
  update journal_entries set reverses_entry_id = null, reversed_by_entry_id = null where true;
  update payments set journal_entry_id = null where true;
  update expenses set journal_entry_id = null where true;
  update water_purchases set journal_entry_id = null where true;
  update expenses set issue_id = null where true;

  -- 3. Delete operational transactions & issues data
  delete from payment_allocations where true;
  delete from payments where true;
  delete from expenses where true;
  delete from water_meter_readings where true;
  delete from water_purchases where true;
  delete from water_period_summary where true;
  delete from invoice_lines where true;
  delete from invoices where true;
  delete from billing_periods where true;

  -- 4. Delete ledger entries and lines
  delete from journal_lines where true;
  delete from journal_entries where true;

  -- 5. Clear sample issue tickets & comments
  delete from issue_votes where true;
  delete from issue_photos where true;
  delete from issue_comments where true;
  delete from issue_estimates where true;
  delete from issues where true;

  -- 6. Restore normal trigger processing
  set local session_replication_role = 'origin';
end;
$$;

grant execute on function reset_all_test_data() to service_role;
