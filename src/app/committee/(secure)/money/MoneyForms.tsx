"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment, recordExpense, verifyPayment } from "./actions";

interface FlatOption {
  id: string;
  number: string;
}
interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export function PaymentForm({ flats }: { flats: FlatOption[] }) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-semibold">Record a payment</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Flat
          <select name="flatId" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select flat…</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>{f.number}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount (₹)
          <input name="amount" required placeholder="e.g. 2500" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mode
          <select name="mode" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="upi">UPI</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input name="paidOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Reference (UPI txn / cheque no.)
          <input name="reference" placeholder="Optional but recommended" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {state && <p className={`mt-2 text-sm ${state.ok ? "text-positive" : "text-negative"}`}>{state.ok ? state.message : state.error}</p>}
      <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50">
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

export function ExpenseForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, action, pending] = useActionState(recordExpense, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-semibold">Record an expense</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select name="categoryAccountId" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select category…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount (₹)
          <input name="amount" required placeholder="e.g. 4500" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Description
          <input name="description" required minLength={2} maxLength={200} placeholder="e.g. Lift AMC — June" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Vendor (optional)
          <input name="vendor" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Paid from
          <select name="paidFrom" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input name="spentOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bill ref (optional)
          <input name="billRef" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {state && <p className={`mt-2 text-sm ${state.ok ? "text-positive" : "text-negative"}`}>{state.ok ? state.message : state.error}</p>}
      <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50">
        {pending ? "Recording…" : "Record expense"}
      </button>
    </form>
  );
}

export function VerifyButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Verify this payment? This will post it to the ledger.")) return;
        start(async () => {
          await verifyPayment(paymentId);
          router.refresh();
        });
      }}
      disabled={pending}
      className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
    >
      {pending ? "…" : "Verify"}
    </button>
  );
}
