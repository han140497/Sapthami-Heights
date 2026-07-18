-- Reshape the building to its real 37 flats, set flat types, and add the Admin role.
--
-- The original seed assumed 3 flats per floor in Block A. The building actually has
-- 4 per floor in both blocks. Corrected layout (confirmed with the committee):
--
--   Block A: floors G,1,2,3,4 with 4 flats each = 20. The four floor-4 units
--            (A-401..A-404) are the penthouses.
--   Block B: floors 1,2,3,4 with 4 flats each = 16, plus one penthouse B-PH01 = 17.
--   Total  : 37.
--
-- Flat type is descriptive only — maintenance is a flat rate for every flat, so the
-- type carries no money and can be corrected in Admin without touching a figure.
-- Rule: units 03 and 04 on a floor are 3BHK, units 01 and 02 are 2BHK; Block A's
-- floor 4 and Block B's B-PH01 are penthouses.

-- 1. Admin role. Admin sits above the committee roles and can do anything; the auth
--    layer treats it as a superset (see src/lib/supabase/committee.ts).
alter table committee_members drop constraint if exists committee_members_role_check;
alter table committee_members
  add constraint committee_members_role_check
  check (role in ('admin', 'president', 'secretary', 'treasurer', 'member'));

-- 2. Add the fourth flat on each Block A floor (was 3/floor, now 4/floor). Idempotent.
do $$
declare
  v_block_a uuid;
  v_floor   text;
begin
  select id into v_block_a from blocks where code = 'A';
  foreach v_floor in array array['G', '1', '2', '3', '4']
  loop
    insert into flats (block_id, floor, number, flat_type)
    values (v_block_a, v_floor, 'A-' || v_floor || '04', '2BHK')
    on conflict (number) do nothing;
  end loop;
end $$;

-- 3. Flat types. Penthouses first, then 3BHK/2BHK for everything that is not a
--    penthouse, keyed off the last two digits of the flat number.
update flats f
   set flat_type = 'penthouse'
  from blocks b
 where b.id = f.block_id
   and ((b.code = 'A' and f.floor = '4') or f.number = 'B-PH01');

update flats
   set flat_type = '3BHK'
 where flat_type <> 'penthouse'
   and right(number, 2) in ('03', '04');

update flats
   set flat_type = '2BHK'
 where flat_type <> 'penthouse'
   and right(number, 2) in ('01', '02');

-- 4. Refuse to finish if the building is not the expected 37. A wrong flat count is
--    a wrong divisor in every future water bill, so it must fail loudly here.
do $$
declare
  v_total integer;
  v_a integer;
  v_b integer;
begin
  select count(*) into v_total from flats;
  select count(*) into v_a from flats f join blocks b on b.id = f.block_id where b.code = 'A';
  select count(*) into v_b from flats f join blocks b on b.id = f.block_id where b.code = 'B';
  if v_total <> 37 or v_a <> 20 or v_b <> 17 then
    raise exception 'expected 37 flats (A=20, B=17), got total=% A=% B=%', v_total, v_a, v_b;
  end if;
end $$;

-- 5. Grant the founding admin. This is the committee login created during setup; it
--    becomes the account with absolute control from the website.
update committee_members cm
   set role = 'admin'
  from auth.users u
 where u.id = cm.user_id
   and u.email = 'hdkolla14@gmail.com'
   and cm.to_date is null;
