-- Seed: chart of accounts and the 32 flats of Sapthami Heights.
--
-- Idempotent throughout — safe to re-run against an existing database.

insert into accounts (code, name, type, normal_side) values
  -- Assets
  ('1000', 'Bank Account',                'asset',     'debit'),
  ('1010', 'Cash in Hand',                'asset',     'debit'),
  ('1100', 'Maintenance Receivable',      'asset',     'debit'),
  -- Liabilities
  ('2000', 'Corpus Fund',                 'liability', 'credit'),
  ('2010', 'Advance from Residents',      'liability', 'credit'),
  -- Equity
  ('3000', 'Corpus / Accumulated Surplus','equity',    'credit'),
  -- Income
  ('4000', 'Maintenance Income',          'income',    'credit'),
  ('4010', 'Water Income',                'income',    'credit'),
  ('4020', 'Penalty Income',              'income',    'credit'),
  ('4030', 'Other Income',                'income',    'credit'),
  -- Expenses
  ('5000', 'Water - Manjeera',            'expense',   'debit'),
  ('5010', 'Water - Tankers',             'expense',   'debit'),
  ('5020', 'Electricity - Common Area',   'expense',   'debit'),
  ('5030', 'Housekeeping',                'expense',   'debit'),
  ('5040', 'Security',                    'expense',   'debit'),
  ('5050', 'Repairs & Maintenance',       'expense',   'debit'),
  ('5060', 'Lift Maintenance',            'expense',   'debit'),
  ('5070', 'Generator & Diesel',          'expense',   'debit'),
  ('5080', 'Gardening',                   'expense',   'debit'),
  ('5090', 'Pest Control',                'expense',   'debit'),
  ('5100', 'Bank Charges',                'expense',   'debit'),
  ('5110', 'Audit & Professional Fees',   'expense',   'debit'),
  ('5120', 'Miscellaneous',               'expense',   'debit')
on conflict (code) do nothing;

insert into blocks (code, name) values
  ('A', 'Block A'),
  ('B', 'Block B')
on conflict (code) do nothing;

-- Block A: floors G, 1, 2, 3, 4 with three flats each = 15.
-- Block B: floors 1, 2, 3, 4 with four flats each = 16, plus one penthouse = 17.
-- Total 32.
--
-- Flat types are a starting assumption, not surveyed fact: block A is recorded as
-- 2BHK and block B as 3BHK. Maintenance is a flat rate for every flat, so flat_type
-- carries no money today — it is descriptive only, and the committee can correct it
-- in Admin without touching a single figure.
do $$
declare
  v_block_a uuid;
  v_block_b uuid;
  v_floor   text;
  v_n       integer;
begin
  select id into v_block_a from blocks where code = 'A';
  select id into v_block_b from blocks where code = 'B';

  foreach v_floor in array array['G', '1', '2', '3', '4']
  loop
    for v_n in 1..3 loop
      insert into flats (block_id, floor, number, flat_type)
      values (v_block_a, v_floor, 'A-' || v_floor || '0' || v_n, '2BHK')
      on conflict (number) do nothing;
    end loop;
  end loop;

  foreach v_floor in array array['1', '2', '3', '4']
  loop
    for v_n in 1..4 loop
      insert into flats (block_id, floor, number, flat_type)
      values (v_block_b, v_floor, 'B-' || v_floor || '0' || v_n, '3BHK')
      on conflict (number) do nothing;
    end loop;
  end loop;

  insert into flats (block_id, floor, number, flat_type)
  values (v_block_b, 'PH', 'B-PH01', 'penthouse')
  on conflict (number) do nothing;
end $$;

-- Refuse to finish if the building came out the wrong shape. A seed that silently
-- produces 31 or 33 flats would surface much later as a wrong divisor in a water
-- bill, which is exactly the kind of error this app exists to prevent.
do $$
declare
  v_total integer;
  v_a     integer;
  v_b     integer;
  v_ph    integer;
begin
  select count(*) into v_total from flats;
  select count(*) into v_a from flats f join blocks b on b.id = f.block_id where b.code = 'A';
  select count(*) into v_b from flats f join blocks b on b.id = f.block_id where b.code = 'B' and f.floor <> 'PH';
  select count(*) into v_ph from flats where floor = 'PH';

  if v_total <> 32 or v_a <> 15 or v_b <> 16 or v_ph <> 1 then
    raise exception
      'seed produced the wrong building: % flats total (expected 32), A=% (expected 15), B=% (expected 16), penthouse=% (expected 1)',
      v_total, v_a, v_b, v_ph;
  end if;
end $$;
