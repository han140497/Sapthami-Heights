/**
 * End-to-end verification against the LIVE Supabase database.
 *
 * Exercises the entire financial engine the way a real month would:
 *   schema sanity -> committee user -> test resident -> water bills + readings ->
 *   close -> verify to the paisa -> reopen (reversal) -> re-close -> payment ->
 *   reconciliation -> attempts to BREAK the ledger (must fail).
 *
 * Run:  node scripts/e2e.mts
 * Then: node scripts/cleanup-test-data.mts   (wipes the test month, keeps structure)
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { computeWaterPeriod } from "../src/lib/water/allocate.ts";

// --- env ---
const env: Record<string, string> = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const DB_URL = env.DATABASE_URL;
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!DB_URL || !SUPABASE_URL || !SERVICE_KEY) throw new Error("missing env");

const sql = postgres(DB_URL, { ssl: "require", prepare: false });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectFailure(name: string, fn: () => Promise<unknown>, needle: string) {
  try {
    await fn();
    check(name, false, "the operation SUCCEEDED but must be refused");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, msg.includes(needle), `failed with unexpected error: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[1] Schema sanity");
const [{ count: flatCount }] = await sql`select count(*)::int as count from flats`;
check("37 flats seeded", flatCount === 37, `got ${flatCount}`);
const [{ count: aCount }] = await sql`
  select count(*)::int as count from flats f join blocks b on b.id = f.block_id where b.code = 'A'`;
check("Block A has 20 flats", aCount === 20, `got ${aCount}`);
const [{ count: phTypeCount }] = await sql`select count(*)::int as count from flats where flat_type = 'penthouse'`;
check("5 penthouse-type flats (A-40x + B-PH01)", phTypeCount === 5, `got ${phTypeCount}`);
const [{ count: acctCount }] = await sql`select count(*)::int as count from accounts`;
check("chart of accounts seeded (>= 23)", acctCount >= 23, `got ${acctCount}`);

// ---------------------------------------------------------------------------
console.log("\n[2] Committee login (Supabase Auth user + committee seat)");
const COMMITTEE_EMAIL = "hdkolla14@gmail.com";
const COMMITTEE_PASSWORD = "SH-" + Math.random().toString(36).slice(2, 10) + "-" + Math.random().toString(36).slice(2, 6);

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

let userId: string | null = null;
{
  const res = await adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: COMMITTEE_EMAIL, password: COMMITTEE_PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (res.ok) {
    userId = body.id;
    console.log(`  created auth user ${COMMITTEE_EMAIL}`);
    console.log(`  TEMP PASSWORD: ${COMMITTEE_PASSWORD}`);
  } else if (String(body.msg ?? body.message ?? "").toLowerCase().includes("already")) {
    const list = await adminFetch(`/auth/v1/admin/users?page=1&per_page=50`);
    const users = (await list.json()).users as { id: string; email: string }[];
    userId = users.find((u) => u.email === COMMITTEE_EMAIL)?.id ?? null;
    console.log(`  auth user already exists; reusing (password unchanged)`);
  } else {
    console.error("  auth user creation failed:", body);
  }
}
check("committee auth user exists", !!userId);

if (userId) {
  const existing = await sql`
    select id from committee_members where user_id = ${userId} and to_date is null`;
  if (existing.length === 0) {
    await sql`insert into committee_members (user_id, role, from_date)
              values (${userId}, 'president', current_date)`;
  }
  const [seat] = await sql`
    select role from committee_members where user_id = ${userId} and to_date is null`;
  // The founding user is promoted to admin by migration 20260718000100; a plain
  // committee run would leave them president. Either is a valid active seat.
  check("active committee seat (admin or president)", seat?.role === "admin" || seat?.role === "president", `got ${seat?.role}`);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Test resident for flat A-101 (phone login credential)");
const TEST_PHONE = "9876543210";
const [flatA101] = await sql`select id, number from flats where number = 'A-101'`;
{
  const cur = await sql`
    select fr.id from flat_residents fr
     where fr.flat_id = ${flatA101.id} and fr.to_date is null and fr.is_primary`;
  if (cur.length === 0) {
    const [r] = await sql`
      insert into residents (name, phone) values ('Test Resident', ${"+91 " + TEST_PHONE})
      returning id, phone`;
    check("phone normalised by DB trigger (+91 stripped)", r.phone === TEST_PHONE, `got ${r.phone}`);
    await sql`insert into flat_residents (flat_id, resident_id, role, is_primary, from_date)
              values (${flatA101.id}, ${r.id}, 'owner', true, current_date)`;
  } else {
    console.log("  primary resident already set; skipping");
    passed++;
  }
}

// ---------------------------------------------------------------------------
console.log("\n[4] A full test month: July 2026");
// ₹2,500 maintenance + ₹500 sinking fund per flat. Idempotent: reuse an existing
// open 2026-07 period and re-lay its inputs so a failed run can be retried.
let [period] = await sql`select id, status from billing_periods where year = 2026 and month = 7`;
if (!period) {
  [period] = await sql`
    insert into billing_periods (year, month, maintenance_paise, sinking_fund_paise)
    values (2026, 7, 250000, 50000)
    returning id, status`;
} else if (period.status !== "open") {
  throw new Error("2026-07 already closed — run cleanup-test-data.mts first");
}
await sql`delete from water_meter_readings where period_id = ${period.id}`;
await sql`delete from water_purchases where period_id = ${period.id}`;

// Water: Manjeera 400 KL @ ₹32,000 + two tankers totalling 100 KL @ ₹18,000.
await sql`insert into water_purchases (period_id, source_type, purchased_on, litres, amount_paise, vendor) values
  (${period.id}, 'manjeera', '2026-07-05', 400000, 3200000, 'HMWSSB'),
  (${period.id}, 'tanker',   '2026-07-12',  60000, 1080000, 'SriSai Tankers'),
  (${period.id}, 'tanker',   '2026-07-25',  40000,  720000, 'SriSai Tankers')`;

// Readings: 36 flats at 12,000 L + A-101 at 38,000 L = 470,000 L metered
// (30,000 L loss = 6%). A-101 heavy so per-flat proportionality is visible.
const flats = await sql`select id, number from flats where is_active order by number`;
for (const f of flats) {
  const litres = f.number === "A-101" ? 38000 : 12000;
  await sql`insert into water_meter_readings (flat_id, period_id, read_on, reading_value, consumption_litres)
            values (${f.id}, ${period.id}, '2026-07-31', ${100000 + litres}, ${litres})`;
}

// Compute with the app's real engine.
const purchases = await sql`
  select source_type, litres, amount_paise from water_purchases where period_id = ${period.id}`;
const readings = await sql`
  select flat_id, consumption_litres from water_meter_readings where period_id = ${period.id}`;
const water = computeWaterPeriod(
  purchases.map((p) => ({ sourceType: p.source_type, litres: Number(p.litres), amountPaise: Number(p.amount_paise) })),
  readings.map((r) => ({ flatId: r.flat_id, consumptionLitres: Number(r.consumption_litres) })),
);
check("engine: metered 470,000 L", water.meteredLitres === 470000);
check("engine: loss 6%", water.lossPct === 6, `got ${water.lossPct}`);
check(
  "engine: allocations sum to ₹50,000.00 exactly",
  water.allocations.reduce((a, x) => a + x.amountPaise, 0) === 5000000,
);

// Passed via sql.json() — pre-stringifying would arrive as a JSON *string*, not an
// object, and the close's stale-payload veto rejects it (verified: it did).
const waterPayload = {
  totalCostPaise: water.totalCostPaise,
  purchasedLitres: water.purchasedLitres,
  meteredLitres: water.meteredLitres,
  lossLitres: water.lossLitres,
  lossPct: water.lossPct,
  blendedRatePaisePerLitre: water.blendedRatePaisePerLitre,
  allocations: water.allocations.map((a) => ({ flatId: a.flatId, amountPaise: a.amountPaise })),
};

console.log("\n[5] Close the period (atomic: snapshot + 37 invoices + ledger)");
const [closeResult] = await sql`
  select close_billing_period(${period.id}, ${sql.json(waterPayload)}, ${userId}) as r`;
check("close returned 37 invoices", closeResult.r.invoice_count === 37, JSON.stringify(closeResult.r));

const [{ sum: waterLineSum }] = await sql`
  select coalesce(sum(il.amount_paise), 0)::bigint as sum
    from invoice_lines il join invoices i on i.id = il.invoice_id
   where i.period_id = ${period.id} and il.kind = 'water' and i.voided_at is null`;
check("37 water lines sum to the water bill TO THE PAISA", Number(waterLineSum) === 5000000, `got ${waterLineSum}`);

const [snap] = await sql`select * from water_period_summary where period_id = ${period.id}`;
check("water snapshot frozen (loss 30,000 L)", Number(snap.loss_litres) === 30000);

const [tb1] = await sql`select variance_paise, unbalanced_entry_count from ledger_health`;
check("ledger balances after close", Number(tb1.variance_paise) === 0 && Number(tb1.unbalanced_entry_count) === 0);

// A-101 used 38,000/470,000 of the water — its share of ₹50,000.
const [a101inv] = await sql`
  select i.total_paise from invoices i
   where i.flat_id = ${flatA101.id} and i.period_id = ${period.id} and i.voided_at is null`;
const a101water = water.allocations.find((a) => a.flatId === flatA101.id)!.amountPaise;
check(
  "A-101 invoice = maintenance + sinking + its exact water share",
  Number(a101inv.total_paise) === 250000 + 50000 + a101water,
  `invoice ${a101inv.total_paise}, water share ${a101water}`,
);

console.log("\n[6] Reopen (reversal, not deletion) and re-close");
const [reopen] = await sql`select reopen_billing_period(${period.id}, 'E2E test reopen', ${userId}) as r`;
check("reopen reversed 37 entries", reopen.r.entries_reversed === 37, JSON.stringify(reopen.r));
const [{ count: voided }] = await sql`
  select count(*)::int as count from invoices where period_id = ${period.id} and voided_at is not null`;
check("old invoices voided, not deleted", voided === 37, `got ${voided}`);
const [tb2] = await sql`select variance_paise from ledger_health`;
check("ledger still balances after reversal", Number(tb2.variance_paise) === 0);

const [reclose] = await sql`
  select close_billing_period(${period.id}, ${sql.json(waterPayload)}, ${userId}) as r`;
check("re-close raised 37 fresh invoices", reclose.r.invoice_count === 37);
const [{ count: revised }] = await sql`
  select count(*)::int as count from invoices
   where period_id = ${period.id} and voided_at is null and invoice_no like '%-R%'`;
check("re-issued invoices carry a revision suffix", revised === 37, `got ${revised}`);

console.log("\n[7] Payment: A-101 pays ₹3,500 by UPI, treasurer verifies");
const [payment] = await sql`
  insert into payments (flat_id, paid_on, amount_paise, mode, reference, status)
  values (${flatA101.id}, '2026-08-02', 350000, 'upi', 'E2E-UPI-REF-001', 'recorded')
  returning id`;
const [liveInv] = await sql`
  select id from invoices where flat_id = ${flatA101.id} and period_id = ${period.id} and voided_at is null`;
await sql`insert into payment_allocations (payment_id, invoice_id, amount_paise)
          values (${payment.id}, ${liveInv.id}, 350000)`;
const [entry] = await sql`
  select post_journal_entry(
    '2026-08-02', 'Payment received — flat A-101', 'payment', ${payment.id},
    ${sql.json([
      { account_code: "1000", debit_paise: 350000 },
      { account_code: "1100", credit_paise: 350000, flat_id: flatA101.id },
    ])}, ${userId}) as id`;
await sql`update payments set status = 'verified', journal_entry_id = ${entry.id} where id = ${payment.id}`;

const [bal] = await sql`select balance_paise from flat_balances where flat_id = ${flatA101.id}`;
check(
  "A-101 balance = invoice − payment",
  Number(bal.balance_paise) === 250000 + 50000 + a101water - 350000,
  `got ${bal.balance_paise}`,
);
const badFlats = await sql`select number, variance_paise from flat_balance_check where variance_paise <> 0`;
check("flat_balance_check: zero variance on all 37 flats", badFlats.length === 0, JSON.stringify(badFlats));

console.log("\n[8] Trying to break the ledger (every attempt must be refused)");
await expectFailure(
  "editing a posted journal line is refused",
  () => sql`update journal_lines set debit_paise = debit_paise + 1
            where id = (select id from journal_lines where debit_paise > 0 limit 1)`,
  "append-only",
);
await expectFailure(
  "deleting a journal entry is refused",
  () => sql`delete from journal_entries where id = (select id from journal_entries limit 1)`,
  "append-only",
);
await expectFailure(
  "an unbalanced entry is refused at commit",
  () => sql`select post_journal_entry(current_date, 'bad entry', 'manual', null,
    '[{"account_code":"1000","debit_paise":100},{"account_code":"1100","credit_paise":99}]'::jsonb, null)`,
  "does not balance",
);
await expectFailure(
  "double-closing a closed period is refused",
  () => sql`select close_billing_period(${period.id}, ${sql.json(waterPayload)}, null)`,
  "already closed",
);
await expectFailure(
  "reopening a period with allocated payments is refused",
  () => sql`select reopen_billing_period(${period.id}, 'should fail', null)`,
  "payments have already been allocated",
);
await expectFailure(
  "duplicate UPI reference is refused",
  () => sql`insert into payments (flat_id, paid_on, amount_paise, mode, reference, status)
            values (${flatA101.id}, '2026-08-03', 100, 'upi', 'E2E-UPI-REF-001', 'recorded')`,
  "duplicate key",
);

const [{ count: auditCount }] = await sql`select count(*)::int as count from audit_log`;
check("audit log captured the activity", auditCount > 50, `got ${auditCount} rows`);

// ---------------------------------------------------------------------------
console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);
if (failed === 0) {
  console.log("The financial engine is verified against the live database.");
  console.log(`Committee login: ${COMMITTEE_EMAIL} (password above if newly created — change it after first login)`);
  console.log("Test data is still in the DB for inspection. Run scripts/cleanup-test-data.mts to wipe it.");
}
await sql.end();
process.exit(failed === 0 ? 0 : 1);
