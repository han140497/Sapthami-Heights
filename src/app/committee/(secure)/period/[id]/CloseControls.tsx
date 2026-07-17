"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { closePeriod, reopenPeriod } from "../actions";

export function CloseButton({ periodId, blocked }: { periodId: string; blocked: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (blocked) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-warning dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{blocked}</span>
      </div>
    );
  }

  function doClose() {
    setError(null);
    start(async () => {
      const result = await closePeriod(periodId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Close failed.");
        setConfirm(false);
      }
    });
  }

  if (!confirm) {
    return (
      <div>
        <button
          onClick={() => setConfirm(true)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          Close this period & raise bills
        </button>
        {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm">
        This raises 32 invoices and posts the ledger. It can be reopened, but only by reversing —
        so do it once the readings and water bills are final.
      </p>
      <div className="flex gap-2">
        <button
          onClick={doClose}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Closing…" : "Yes, close it"}
        </button>
        <button onClick={() => setConfirm(false)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}

export function ReopenButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function doReopen() {
    setError(null);
    start(async () => {
      const result = await reopenPeriod(periodId, reason);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Reopen failed.");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-foreground">
        Reopen period
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-sm">
        Reopening reverses every invoice&apos;s ledger entry (originals stay visible) and voids the
        bills. Give a reason for the record.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Tanker bill was entered wrong"
        className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={doReopen}
          disabled={pending || reason.trim().length < 3}
          className="rounded-lg bg-negative px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Reopening…" : "Reopen"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}
