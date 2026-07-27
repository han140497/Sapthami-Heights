import {
  getFlats,
  getExpenseAccounts,
  getRecentPayments,
  getRecentExpenses,
  getAllFlatBalances,
  getPeriods,
} from "@/lib/db/queries";
import { Card, PageHeader, Badge, Money, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { PaymentForm, ExpenseForm } from "./MoneyForms";
import { PaymentRowActions } from "./PaymentRowActions";
import { ExpenseRowActions } from "./ExpenseRowActions";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const [flats, accounts, payments, expenses, balances, periods] = await Promise.all([
    getFlats(),
    getExpenseAccounts(),
    getRecentPayments(25),
    getRecentExpenses(25),
    getAllFlatBalances(),
    getPeriods(),
  ]);

  const flatOptions = flats.map((f) => ({ id: f.id as string, number: f.number as string }));
  const accountOptions = accounts.map((a) => ({ id: a.id as string, code: a.code as string, name: a.name as string }));
  const periodOptions = periods.map((p) => ({ id: p.id, month: p.month, year: p.year }));
  const defaulters = balances.filter((b) => b.balance_paise > 0).sort((a, b) => b.balance_paise - a.balance_paise);

  const pendingPayments = payments.filter((p) => p.status === "recorded");

  return (
    <>
      <PageHeader title="Money" subtitle="Record payments and expenses. Nothing here moves money — it records what already happened." />

      {pendingPayments.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent/40 bg-accent/5 p-4 shadow-sm">
          <h3 className="font-semibold text-accent flex items-center gap-2">
            🔔 {pendingPayments.length} Pending Resident Payment Claim{pendingPayments.length > 1 ? "s" : ""}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Residents have submitted payment claims below. Click <strong>Verify</strong> to approve and post to the ledger.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentForm flats={flatOptions} />
        <ExpenseForm accounts={accountOptions} periods={periodOptions} />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent payments</h2>
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{p.flat_number ?? "—"}</div>
                        <div className="text-xs text-muted capitalize">{p.mode} · {p.paid_on}</div>
                      </td>
                      <td className="px-2 py-2.5"><Badge value={p.status} /></td>
                      <td className="px-4 py-2.5 text-right tabular">{formatPaise(p.amount_paise)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <PaymentRowActions payment={p} flats={flatOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent expenses</h2>
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {(expenses as {
                    id: string;
                    category_account_id: string;
                    description: string;
                    vendor?: string | null;
                    spent_on: string;
                    paid_from: string;
                    bill_ref?: string | null;
                    period_id?: string | null;
                    amount_paise: number;
                    accounts?: { name?: string };
                  }[]).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-muted">{e.accounts?.name} · {e.spent_on}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{formatPaise(e.amount_paise)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <ExpenseRowActions expense={e} accounts={accountOptions} periods={periodOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Outstanding dues ({defaulters.length})</h2>
        {defaulters.length === 0 ? (
          <EmptyState title="Every flat is up to date" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <tbody>
                {defaulters.map((d) => (
                  <tr key={d.flat_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{d.number}</td>
                    <td className="px-4 py-2.5 text-right"><Money paise={d.balance_paise} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}
