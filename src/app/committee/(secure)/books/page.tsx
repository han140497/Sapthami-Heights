import { getTrialBalance, getLedgerHealth, getFlatBalanceCheck } from "@/lib/db/queries";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const [tb, health, flatCheck] = await Promise.all([
    getTrialBalance(),
    getLedgerHealth(),
    getFlatBalanceCheck(),
  ]);

  const totalDebit = tb.reduce((a, r) => a + r.debit_paise, 0);
  const totalCredit = tb.reduce((a, r) => a + r.credit_paise, 0);
  const ledgerOk = health && health.variance_paise === 0 && health.unbalanced_entry_count === 0;
  const flatVariances = flatCheck.filter((f) => f.variance_paise !== 0);
  const withActivity = tb.filter((r) => r.debit_paise !== 0 || r.credit_paise !== 0);

  return (
    <>
      <PageHeader title="Books" subtitle="The double-entry ledger. If these don't balance, something is wrong — and it says so here." />

      {/* The two invariants, stated plainly. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Reconciliation
          ok={!!ledgerOk}
          okText="Ledger balances — total debits equal total credits."
          badText={`Ledger off by ${formatPaise(Math.abs(health?.variance_paise ?? 0))}${
            health && health.unbalanced_entry_count > 0 ? ` across ${health.unbalanced_entry_count} entries` : ""
          }.`}
        />
        <Reconciliation
          ok={flatVariances.length === 0}
          okText="Every flat's ledger balance matches its invoices minus payments."
          badText={`${flatVariances.length} flat${flatVariances.length === 1 ? "" : "s"} show a mismatch between the ledger and the bills.`}
        />
      </div>

      {flatVariances.length > 0 && (
        <Card className="mb-6 border-red-200 dark:border-red-900">
          <h3 className="mb-2 font-semibold text-negative">Flats needing investigation</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-1 text-left font-medium">Flat</th>
                <th className="py-1 text-right font-medium">Invoiced</th>
                <th className="py-1 text-right font-medium">Verified paid</th>
                <th className="py-1 text-right font-medium">Ledger</th>
                <th className="py-1 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {flatVariances.map((f) => (
                <tr key={f.flat_id} className="border-t border-border">
                  <td className="py-1.5 font-medium">{f.number}</td>
                  <td className="py-1.5 text-right tabular">{formatPaise(f.invoiced_paise)}</td>
                  <td className="py-1.5 text-right tabular">{formatPaise(f.verified_paid_paise)}</td>
                  <td className="py-1.5 text-right tabular">{formatPaise(f.ledger_balance_paise)}</td>
                  <td className="py-1.5 text-right tabular text-negative">{formatPaise(f.variance_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold">Trial balance</h2>
      {withActivity.length === 0 ? (
        <EmptyState title="No ledger activity yet" hint="Balances appear once you close a period or record money." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Account</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {withActivity.map((r) => (
                <tr key={r.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-muted">{r.code}</span> {r.name}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{r.debit_paise ? formatPaise(r.debit_paise) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular">{r.credit_paise ? formatPaise(r.credit_paise) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular font-medium">{formatPaise(r.balance_paise)}</td>
                </tr>
              ))}
              <tr className="bg-background/50 font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular">{formatPaise(totalDebit)}</td>
                <td className="px-4 py-2.5 text-right tabular">{formatPaise(totalCredit)}</td>
                <td className="px-4 py-2.5 text-right tabular">
                  {totalDebit === totalCredit ? "✓" : formatPaise(totalDebit - totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Reconciliation({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-positive" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-negative" />
      )}
      <span className={ok ? "text-positive" : "text-negative"}>{ok ? okText : badText}</span>
    </div>
  );
}
