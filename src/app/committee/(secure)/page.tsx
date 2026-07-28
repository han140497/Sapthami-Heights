import Link from "next/link";
import {
  getAllFlatBalances,
  getSocietySummary,
  getIssues,
  getLedgerHealth,
  getWaterTransparency,
  getPeriods,
  getRecentPayments,
} from "@/lib/db/queries";
import { Card, PageHeader, StatTile, Money, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { MonthlyChecklist } from "./MonthlyChecklist";
import { CashBankSummary } from "./CashBankSummary";

import { WhatsAppReminderButton } from "./money/WhatsAppReminderButton";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["open", "acknowledged", "estimating", "approved", "in_progress"]);

export default async function CommitteeDashboard() {
  const [balances, summary, issues, health, water, periods, payments] = await Promise.all([
    getAllFlatBalances(),
    getSocietySummary(),
    getIssues(),
    getLedgerHealth(),
    getWaterTransparency(),
    getPeriods(),
    getRecentPayments(50),
  ]);

  const defaulters = balances.filter((b) => b.balance_paise > 0).sort((a, b) => b.balance_paise - a.balance_paise);
  const totalOutstanding = defaulters.reduce((a, b) => a + b.balance_paise, 0);
  const totalBilled = balances.reduce((a, b) => a + b.billed_paise, 0);
  const totalPaid = balances.reduce((a, b) => a + b.paid_paise, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 100;
  const openIssues = issues.filter((i) => OPEN_STATUSES.has(i.status));
  const ledgerOk = health && health.variance_paise === 0 && health.unbalanced_entry_count === 0;
  const latestWater = water[0];

  const pendingPayments = payments.filter((p) => p.status === "recorded");
  const openPeriod = periods.find((p) => p.status === "open");

  return (
    <>
      <PageHeader title="Committee dashboard" subtitle="The state of the society's money, at a glance." />

      <MonthlyChecklist
        pendingPaymentsCount={pendingPayments.length}
        hasOpenPeriod={!!openPeriod}
        openPeriodId={openPeriod?.id}
      />

      <CashBankSummary bankPaise={summary.bank} cashPaise={summary.cash} />

      {/* Ledger health banner — the single most important signal on the page. */}
      <div
        className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${
          ledgerOk
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
        }`}
      >
        {ledgerOk ? (
          <CheckCircle2 className="h-5 w-5 text-positive" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-negative" />
        )}
        <div className="text-sm">
          {ledgerOk ? (
            <span className="font-medium text-positive">Books balance. Debits equal credits across the ledger.</span>
          ) : (
            <span className="font-medium text-negative">
              Ledger is out of balance by {formatPaise(Math.abs(health?.variance_paise ?? 0))}
              {health && health.unbalanced_entry_count > 0
                ? ` across ${health.unbalanced_entry_count} entr${health.unbalanced_entry_count === 1 ? "y" : "ies"}`
                : ""}
              . Check the Books page.
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Collection rate"
          value={`${collectionRate}%`}
          tone={collectionRate >= 90 ? "positive" : collectionRate >= 70 ? "warning" : "negative"}
          hint={`${formatPaise(totalPaid)} of ${formatPaise(totalBilled)}`}
        />
        <StatTile
          label="Outstanding dues"
          value={formatPaise(totalOutstanding)}
          tone={totalOutstanding > 0 ? "warning" : "positive"}
          hint={`${defaulters.length} flat${defaulters.length === 1 ? "" : "s"}`}
        />
        <StatTile label="Cash position" value={formatPaise(summary.bank + summary.cash)} hint="Bank + cash" />
        <StatTile
          label="Open issues"
          value={String(openIssues.length)}
          tone={openIssues.length > 0 ? "warning" : "positive"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Defaulters</h2>
            <Link href="/committee/money" className="text-sm text-accent hover:underline">
              Record a payment →
            </Link>
          </div>
          {defaulters.length === 0 ? (
            <EmptyState title="No dues outstanding" hint="Every flat is up to date." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {defaulters.slice(0, 10).map((d) => (
                    <tr key={d.flat_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{d.number}</td>
                      <td className="px-4 py-3 text-right">
                        <Money paise={d.balance_paise} signed />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <WhatsAppReminderButton flatNumber={d.number} amountPaise={d.balance_paise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Latest water period</h2>
            <Link href="/committee/period" className="text-sm text-accent hover:underline">
              Manage periods →
            </Link>
          </div>
          {!latestWater ? (
            <EmptyState title="No water periods closed yet" />
          ) : (
            <Card className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Period</span>
                <span className="font-medium">{latestWater.month}/{latestWater.year}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Water spent</span>
                <span className="tabular">{formatPaise(latestWater.total_cost_paise)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Loss</span>
                <span className={`tabular ${latestWater.loss_pct > 10 ? "text-warning" : ""}`}>
                  {latestWater.loss_pct}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Blended rate</span>
                <span className="tabular">
                  ₹{((latestWater.blended_rate_paise_per_litre * 1000) / 100).toFixed(2)}/KL
                </span>
              </div>
            </Card>
          )}
        </section>
      </div>

      {periods.some((p) => p.status === "open") && (
        <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
          There{" "}
          {periods.filter((p) => p.status === "open").length === 1 ? "is an" : "are"}{" "}
          open billing period awaiting close.{" "}
          <Link href="/committee/period" className="font-medium text-accent hover:underline">
            Go to Periods →
          </Link>
        </div>
      )}
    </>
  );
}
