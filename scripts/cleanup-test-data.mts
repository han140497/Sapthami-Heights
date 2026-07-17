/**
 * Wipe the E2E/demo TEST DATA from the database, leaving the real structure intact.
 *
 * Removes: the July 2026 test billing period and everything hanging off it
 * (invoices, invoice lines, ledger entries, water purchases, readings, summary),
 * the test payment on A-101, and the test resident on A-101.
 *
 * Keeps: the 32 flats, blocks, chart of accounts, and committee logins.
 *
 * Run when you are ready to enter real figures:  node scripts/cleanup-test-data.mts
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env: Record<string, string> = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

const sql = postgres(env.DATABASE_URL, { ssl: "require", prepare: false });

// The ledger is append-only by trigger, so ledger entries cannot be deleted through
// normal DML. This cleanup is the one sanctioned exception — it temporarily lifts the
// immutability guard to remove TEST journal rows, then restores it. It must never run
// against real books; it exists only to clear the demo month.
console.log("Removing test data (July 2026 period, test resident, test payment)…");

await sql.begin(async (tx) => {
  const periods = await tx`select id from billing_periods where year = 2026 and month = 7`;
  const periodIds = periods.map((p) => p.id);

  // Disable the append-only guards for this transaction only.
  await tx`alter table journal_entries disable trigger journal_entries_immutable_trg`;
  await tx`alter table journal_lines disable trigger journal_lines_immutable_trg`;

  if (periodIds.length > 0) {
    // Ledger entries tied to this period's invoices, expenses, and water.
    await tx`
      delete from journal_lines where entry_id in (
        select je.id from journal_entries je
        left join invoices i on i.id = je.source_id and je.source_type in ('invoice','reversal')
        where (i.period_id = any(${periodIds}))
           or je.source_type = 'water_purchase'
      )`;
    await tx`
      delete from journal_entries where id in (
        select je.id from journal_entries je
        left join invoices i on i.id = je.source_id and je.source_type in ('invoice','reversal')
        where (i.period_id = any(${periodIds}))
           or je.source_type = 'water_purchase'
      )`;
    await tx`delete from water_period_summary where period_id = any(${periodIds})`;
    await tx`delete from water_meter_readings where period_id = any(${periodIds})`;
    await tx`delete from water_purchases where period_id = any(${periodIds})`;
    await tx`delete from invoices where period_id = any(${periodIds})`;
    await tx`delete from billing_periods where id = any(${periodIds})`;
  }

  // Test payment and its ledger entry on A-101 (identified by the E2E reference).
  const pay = await tx`select id, journal_entry_id from payments where reference = 'E2E-UPI-REF-001'`;
  for (const p of pay) {
    if (p.journal_entry_id) {
      await tx`delete from journal_lines where entry_id = ${p.journal_entry_id}`;
      await tx`delete from journal_entries where id = ${p.journal_entry_id}`;
    }
  }
  await tx`delete from payments where reference = 'E2E-UPI-REF-001'`;

  // Test resident on A-101.
  await tx`
    delete from flat_residents where resident_id in (
      select id from residents where phone = '9876543210' and name = 'Test Resident'
    )`;
  await tx`delete from residents where phone = '9876543210' and name = 'Test Resident'`;

  await tx`alter table journal_entries enable trigger journal_entries_immutable_trg`;
  await tx`alter table journal_lines enable trigger journal_lines_immutable_trg`;
});

const [{ variance_paise }] = await sql`select variance_paise from ledger_health`;
console.log(`Done. Ledger variance after cleanup: ${variance_paise} paise (must be 0).`);
if (Number(variance_paise) !== 0) {
  console.error("WARNING: ledger no longer balances — inspect before entering real data.");
  process.exitCode = 1;
}
await sql.end();
