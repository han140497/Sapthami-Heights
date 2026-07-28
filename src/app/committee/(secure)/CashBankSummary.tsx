"use client";

import { Building2, Wallet, Landmark } from "lucide-react";
import { formatPaise } from "@/lib/money";

export function CashBankSummary({
  bankPaise,
  cashPaise,
}: {
  bankPaise: number;
  cashPaise: number;
}) {
  const totalLiquid = bankPaise + cashPaise;

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Cash & Bank Balance Reconciliation</h2>
          <p className="text-xs text-muted">Real-time liquid reserves across society bank and petty cash accounts.</p>
        </div>
        <span className="rounded-full bg-positive/10 px-3 py-1 text-xs font-semibold text-positive">
          Liquid Reserves
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background/50 p-4 flex items-center gap-3">
          <div className="rounded-full bg-accent/10 p-2.5 text-accent">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">Bank Account (1000)</div>
            <div className="text-base font-bold tabular">{formatPaise(bankPaise)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/50 p-4 flex items-center gap-3">
          <div className="rounded-full bg-warning/10 p-2.5 text-warning">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">Petty Cash (1010)</div>
            <div className="text-base font-bold tabular">{formatPaise(cashPaise)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-positive/30 bg-positive/5 p-4 flex items-center gap-3">
          <div className="rounded-full bg-positive/10 p-2.5 text-positive">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-positive font-medium">Total Liquid Reserves</div>
            <div className="text-base font-bold text-positive tabular">{formatPaise(totalLiquid)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
