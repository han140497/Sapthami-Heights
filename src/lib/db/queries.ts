import { getServiceClient } from "@/lib/supabase/admin";
import type {
  BillingPeriodRow,
  FlatBalanceRow,
  InvoiceLineRow,
  InvoiceRow,
  IssueCostRow,
  IssueRow,
  PaymentRow,
  TrialBalanceRow,
  WaterTransparencyRow,
} from "./types";

/**
 * Read queries. Every function here runs on the server with the service client.
 * Resident-scoped functions REQUIRE a flatId argument and filter by it — they never
 * accept "give me everything" — because the flatId is the resident access boundary
 * and it must be applied at the query, not left to the caller to remember.
 */

// --- Society-wide (visible to everyone) ---

export async function getFlats() {
  const { data } = await getServiceClient()
    .from("flats")
    .select("id, number, floor, flat_type, block_id, is_active, blocks(code)")
    .eq("is_active", true)
    .order("number");
  return data ?? [];
}

export async function getBlocksWithFlats() {
  const { data } = await getServiceClient()
    .from("blocks")
    .select("id, code, name, flats(id, number, floor, flat_type, is_active)")
    .order("code");
  return data ?? [];
}

export async function getPeriods(): Promise<BillingPeriodRow[]> {
  const { data } = await getServiceClient()
    .from("billing_periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return (data as BillingPeriodRow[]) ?? [];
}

export async function getWaterTransparency(): Promise<WaterTransparencyRow[]> {
  const { data } = await getServiceClient()
    .from("water_period_transparency")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return (data as WaterTransparencyRow[]) ?? [];
}

export async function getTrialBalance(): Promise<TrialBalanceRow[]> {
  const { data } = await getServiceClient().from("trial_balance").select("*").order("code");
  return (data as TrialBalanceRow[]) ?? [];
}

export async function getLedgerHealth() {
  const { data } = await getServiceClient().from("ledger_health").select("*").maybeSingle();
  return data as {
    total_debit_paise: number;
    total_credit_paise: number;
    variance_paise: number;
    unbalanced_entry_count: number;
  } | null;
}

/** Society income vs expense, derived from the trial balance. */
export async function getSocietySummary() {
  const tb = await getTrialBalance();
  const income = tb.filter((r) => r.type === "income").reduce((a, r) => a + r.balance_paise, 0);
  const expense = tb.filter((r) => r.type === "expense").reduce((a, r) => a + r.balance_paise, 0);
  const bank = tb.find((r) => r.code === "1000")?.balance_paise ?? 0;
  const cash = tb.find((r) => r.code === "1010")?.balance_paise ?? 0;
  const receivable = tb.find((r) => r.code === "1100")?.balance_paise ?? 0;
  const sinkingFund = tb.find((r) => r.code === "2000")?.balance_paise ?? 0;
  const expenseByCategory = tb
    .filter((r) => r.type === "expense" && r.balance_paise !== 0)
    .map((r) => ({ code: r.code, name: r.name, amount_paise: r.balance_paise }))
    .sort((a, b) => b.amount_paise - a.amount_paise);
  return { income, expense, bank, cash, receivable, sinkingFund, expenseByCategory };
}

// --- Committee-wide ---

export async function getAllFlatBalances(): Promise<FlatBalanceRow[]> {
  const { data } = await getServiceClient()
    .from("flat_balances")
    .select("*")
    .order("number");
  return (data as FlatBalanceRow[]) ?? [];
}

export async function getRecentPayments(limit = 20): Promise<(PaymentRow & { flat_number?: string })[]> {
  const { data } = await getServiceClient()
    .from("payments")
    .select("*, flats(number)")
    .order("paid_on", { ascending: false })
    .limit(limit);
  return ((data ?? []) as (PaymentRow & { flats?: { number?: string } })[]).map((p) => ({
    ...p,
    flat_number: p.flats?.number,
  }));
}

export async function getRecentExpenses(limit = 20) {
  const { data } = await getServiceClient()
    .from("expenses")
    .select("*, accounts(name, code)")
    .order("spent_on", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getExpenseAccounts() {
  const { data } = await getServiceClient()
    .from("accounts")
    .select("id, code, name")
    .eq("type", "expense")
    .eq("is_active", true)
    .order("code");
  return data ?? [];
}

export async function getFlatBalanceCheck() {
  const { data } = await getServiceClient().from("flat_balance_check").select("*").order("number");
  return (data ?? []) as {
    flat_id: string;
    number: string;
    invoiced_paise: number;
    verified_paid_paise: number;
    ledger_balance_paise: number;
    variance_paise: number;
  }[];
}

// --- Flat-scoped (resident) ---

export async function getFlatByNumber(number: string) {
  const { data } = await getServiceClient()
    .from("flats")
    .select("id, number, floor, flat_type, blocks(code, name)")
    .eq("number", number)
    .maybeSingle();
  return data;
}

export async function getFlatBalance(flatId: string): Promise<FlatBalanceRow | null> {
  const { data } = await getServiceClient()
    .from("flat_balances")
    .select("*")
    .eq("flat_id", flatId)
    .maybeSingle();
  return (data as FlatBalanceRow) ?? null;
}

export async function getFlatInvoices(flatId: string): Promise<InvoiceRow[]> {
  const { data } = await getServiceClient()
    .from("invoices")
    .select("*")
    .eq("flat_id", flatId)
    .is("voided_at", null)
    .order("issued_on", { ascending: false });
  return (data as InvoiceRow[]) ?? [];
}

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLineRow[]> {
  const { data } = await getServiceClient()
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("kind");
  return (data as InvoiceLineRow[]) ?? [];
}

export async function getFlatPayments(flatId: string): Promise<PaymentRow[]> {
  const { data } = await getServiceClient()
    .from("payments")
    .select("*")
    .eq("flat_id", flatId)
    .order("paid_on", { ascending: false });
  return (data as PaymentRow[]) ?? [];
}

/**
 * The exact water charge billed to a flat in each period, taken from the invoice
 * line itself — not recomputed. The invoice is the source of truth; recomputing
 * litres × rate could disagree by a paisa (the bill uses largest-remainder
 * allocation), and a transparency screen that contradicts the bill is worse than
 * none. Returns a map of period_id -> billed water paise.
 */
export async function getFlatWaterCharges(flatId: string): Promise<Map<string, number>> {
  const { data } = await getServiceClient()
    .from("invoices")
    .select("period_id, invoice_lines(kind, amount_paise)")
    .eq("flat_id", flatId)
    .is("voided_at", null);
  const map = new Map<string, number>();
  for (const inv of (data ?? []) as {
    period_id: string;
    invoice_lines: { kind: string; amount_paise: number }[];
  }[]) {
    const water = inv.invoice_lines
      .filter((l) => l.kind === "water")
      .reduce((a, l) => a + l.amount_paise, 0);
    map.set(inv.period_id, water);
  }
  return map;
}

/** A flat's water line for each period, joined to that period's transparency data. */
export async function getFlatWaterHistory(flatId: string) {
  const { data } = await getServiceClient()
    .from("water_meter_readings")
    .select("period_id, consumption_litres, is_estimated, reading_value, read_on, billing_periods(year, month, status)")
    .eq("flat_id", flatId)
    .order("read_on", { ascending: false });
  return data ?? [];
}

// --- Issues (visible to all; raised by residents, managed by committee) ---

export async function getIssues(): Promise<IssueRow[]> {
  const { data } = await getServiceClient()
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as IssueRow[]) ?? [];
}

export async function getIssueCostSummary(): Promise<IssueCostRow[]> {
  const { data } = await getServiceClient().from("issue_cost_summary").select("*");
  return (data as IssueCostRow[]) ?? [];
}

export async function getIssue(id: string) {
  const admin = getServiceClient();
  const [{ data: issue }, { data: estimates }, { data: comments }] = await Promise.all([
    admin.from("issues").select("*").eq("id", id).maybeSingle(),
    admin.from("issue_estimates").select("*").eq("issue_id", id).order("created_at"),
    admin.from("issue_comments").select("*").eq("issue_id", id).order("created_at"),
  ]);
  return { issue: issue as IssueRow | null, estimates: estimates ?? [], comments: comments ?? [] };
}
