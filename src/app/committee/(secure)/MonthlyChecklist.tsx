"use client";

import Link from "next/link";
import { CheckCircle, Clock, ArrowRight } from "lucide-react";

export function MonthlyChecklist({
  pendingPaymentsCount,
  hasOpenPeriod,
  openPeriodId,
}: {
  pendingPaymentsCount: number;
  hasOpenPeriod: boolean;
  openPeriodId?: string;
}) {
  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Monthly Committee Workflow Checklist</h2>
          <p className="text-xs text-muted">Complete these 3 simple steps each month to keep society billing on track.</p>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          Month Workflow
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Step 1 */}
        <div className={`rounded-lg border p-4 flex flex-col justify-between ${
          pendingPaymentsCount > 0 ? "border-accent/50 bg-accent/5" : "border-border bg-background/50"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Step 1</span>
              {pendingPaymentsCount === 0 ? (
                <CheckCircle className="h-4 w-4 text-positive" />
              ) : (
                <Clock className="h-4 w-4 text-accent animate-pulse" />
              )}
            </div>
            <h3 className="text-sm font-semibold">Verify Payment Claims</h3>
            <p className="mt-1 text-xs text-muted">
              {pendingPaymentsCount > 0
                ? `${pendingPaymentsCount} resident payment claim(s) awaiting approval.`
                : "All resident payments are verified & posted."}
            </p>
          </div>
          <Link
            href="/committee/money"
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Review Payments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Step 2 */}
        <div className="rounded-lg border border-border bg-background/50 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Step 2</span>
              <Clock className="h-4 w-4 text-muted" />
            </div>
            <h3 className="text-sm font-semibold">Record Readings & Expenses</h3>
            <p className="mt-1 text-xs text-muted">
              Enter current water meter readings and log any monthly maintenance expenses.
            </p>
          </div>
          <Link
            href={openPeriodId ? `/committee/period/${openPeriodId}` : "/committee/period"}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Enter Readings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Step 3 */}
        <div className={`rounded-lg border p-4 flex flex-col justify-between ${
          hasOpenPeriod ? "border-positive/50 bg-positive/5" : "border-border bg-background/50"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Step 3</span>
              {hasOpenPeriod ? (
                <Clock className="h-4 w-4 text-positive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-positive" />
              )}
            </div>
            <h3 className="text-sm font-semibold">Close Month & Issue Bills</h3>
            <p className="mt-1 text-xs text-muted">
              {hasOpenPeriod
                ? "Open billing period is ready to calculate water rates and issue invoices."
                : "No open period currently awaiting close."}
            </p>
          </div>
          <Link
            href="/committee/period"
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Manage Periods <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
