import { getSocietySummary, getPeriods } from "@/lib/db/queries";
import { Card, PageHeader, StatTile, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SocietyPage() {
  const [summary, periods] = await Promise.all([getSocietySummary(), getPeriods()]);
  const surplus = summary.income - summary.expense;
  const maxExpense = Math.max(1, ...summary.expenseByCategory.map((c) => c.amount_paise));

  return (
    <>
      <PageHeader
        title="The society's money"
        subtitle="Everything the committee collects and spends, open to every resident."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="In the bank" value={formatPaise(summary.bank)} />
        <StatTile label="Cash in hand" value={formatPaise(summary.cash)} />
        <StatTile
          label="Yet to collect"
          value={formatPaise(summary.receivable)}
          tone={summary.receivable > 0 ? "warning" : "default"}
          hint="Outstanding dues across all flats"
        />
        <StatTile label="Sinking fund" value={formatPaise(summary.sinkingFund)} hint="Reserved for big repairs" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total income" value={formatPaise(summary.income)} tone="positive" />
        <StatTile label="Total expense" value={formatPaise(summary.expense)} />
        <StatTile
          label={surplus >= 0 ? "Surplus" : "Deficit"}
          value={formatPaise(Math.abs(surplus))}
          tone={surplus >= 0 ? "positive" : "negative"}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Where it goes</h2>
        {summary.expenseByCategory.length === 0 ? (
          <EmptyState title="No expenses recorded yet" />
        ) : (
          <Card className="flex flex-col gap-3">
            {summary.expenseByCategory.map((c) => (
              <div key={c.code}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="tabular font-medium">{formatPaise(c.amount_paise)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(c.amount_paise / maxExpense) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Billing periods</h2>
        {periods.length === 0 ? (
          <EmptyState title="No periods yet" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Period</th>
                  <th className="px-4 py-2 text-left font-medium">Maintenance</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{p.month}/{p.year}</td>
                    <td className="px-4 py-3 tabular">{formatPaise(p.maintenance_paise)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{p.status}</td>
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
