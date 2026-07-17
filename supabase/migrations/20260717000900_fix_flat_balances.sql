-- Fix: flat_balances billed/paid must be what a resident means by those words.
--
-- The original view summed gross debit and credit on the receivable account. That
-- gives the right *balance*, but the moment a period is reopened, the reversal
-- entries inflate both components: a flat that was billed ₹6,829 and paid ₹3,500
-- showed "Total billed ₹13,659, Total paid ₹10,329" because the reversal's debit
-- and credit were counted as another bill and another payment. The net was right;
-- the story it told a resident was nonsense.
--
-- Billed and paid are now taken from the operational tables — non-voided invoices
-- and verified payments — which is exactly what those words mean on a statement.
-- The balance stays equal to the ledger receivable because flat_balance_check
-- enforces zero variance between the two; if they ever diverge, that check fires.
create or replace view flat_balances as
select
  f.id as flat_id,
  f.number,
  coalesce((
    select sum(i.total_paise) from invoices i
     where i.flat_id = f.id and i.voided_at is null
  ), 0) as billed_paise,
  coalesce((
    select sum(p.amount_paise) from payments p
     where p.flat_id = f.id and p.status = 'verified'
  ), 0) as paid_paise,
  coalesce((
    select sum(i.total_paise) from invoices i
     where i.flat_id = f.id and i.voided_at is null
  ), 0)
  - coalesce((
    select sum(p.amount_paise) from payments p
     where p.flat_id = f.id and p.status = 'verified'
  ), 0) as balance_paise
from flats f
where f.is_active;

alter view flat_balances set (security_invoker = on);

comment on view flat_balances is
  'Positive balance_paise = the flat owes the society. Negative = in advance. Billed and paid come from invoices/payments, not gross ledger sides, so reopened periods do not distort them.';
