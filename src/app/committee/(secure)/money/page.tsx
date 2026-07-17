import {
  getFlats,
  getExpenseAccounts,
  getRecentPayments,
  getRecentExpenses,
  getAllFlatBalances,
} from "@/lib/db/queries";
import { Card, PageHeader, Badge, Money, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { PaymentForm, ExpenseForm, VerifyButton } from "./MoneyForms";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const [flats, accounts, payments, expenses, balances] = await Promise.all([
    getFlats(),
    getExpenseAccounts(),
    getRecentPayments(15),
    getRecentExpenses(15),
    getAllFlatBalances(),
  ]);

  const flatOptions = flats.map((f) => ({ id: f.id as string, number: f.number as string }));
  const accountOptions = accounts.map((a) => ({ id: a.id as string, code: a.code as string, name: a.name as string }));
  const defaulters = balances.filter((b) => b.balance_paise > 0).sort((a, b) => b.balance_paise - a.balance_paise);

  return (
    <>
      <PageHeader title="Money" subtitle="Record payments and expenses. Nothing here moves money — it records what already happened." />

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentForm flats={flatOptions} />
        <ExpenseForm accounts={accountOptions} />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent payments</h2>
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" />
          ) : (
            <Card className="p-0">
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
                        {p.status === "recorded" ? <VerifyButton paymentId={p.id} /> : null}
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
            <Card className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {(expenses as {
                    id: string;
                    description: string;
                    spent_on: string;
                    amount_paise: number;
                    accounts?: { name?: string };
                  }[]).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-muted">{e.accounts?.name} · {e.spent_on}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{formatPaise(e.amount_paise)}</td>
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
          <Card className="p-0">
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
