"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIssueStatus, addEstimate, decideEstimate } from "./actions";

const STATUSES = ["open", "acknowledged", "estimating", "approved", "in_progress", "resolved", "closed", "rejected"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export function StatusControl({ issueId, status, priority }: { issueId: string; status: string; priority: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(next: { status?: string; priority?: string }) {
    start(async () => {
      await updateIssueStatus(issueId, next.status ?? status, next.priority ?? priority);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex items-center gap-1.5 text-sm">
        Status
        <select
          value={status}
          disabled={pending}
          onChange={(e) => change({ status: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm capitalize"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        Priority
        <select
          value={priority}
          disabled={pending}
          onChange={(e) => change({ priority: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm capitalize"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">{p}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function AddEstimateForm({ issueId }: { issueId: string }) {
  const [state, action, pending] = useActionState(addEstimate, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <input type="hidden" name="issueId" value={issueId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="vendor" required placeholder="Vendor / contractor" className="rounded border border-border bg-surface px-2 py-1.5 text-sm" />
        <input name="amount" required placeholder="Quote (₹)" className="rounded border border-border bg-surface px-2 py-1.5 text-sm" />
      </div>
      <input name="description" placeholder="What's covered (optional)" className="rounded border border-border bg-surface px-2 py-1.5 text-sm" />
      {state && !state.ok && <p className="text-sm text-negative">{state.error}</p>}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
        {pending ? "Adding…" : "Add quote"}
      </button>
    </form>
  );
}

export function EstimateDecision({ estimateId, issueId, status }: { estimateId: string; issueId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status !== "proposed") return null;

  function decide(decision: "approved" | "rejected") {
    start(async () => {
      await decideEstimate(estimateId, issueId, decision);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1.5">
      <button onClick={() => decide("approved")} disabled={pending} className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50">
        Approve
      </button>
      <button onClick={() => decide("rejected")} disabled={pending} className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-negative disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
