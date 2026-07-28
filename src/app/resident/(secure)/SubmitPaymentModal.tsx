"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Send } from "lucide-react";
import { useToast } from "@/components/ui";
import { submitResidentPaymentClaim } from "../actions";

export function SubmitPaymentModal() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await submitResidentPaymentClaim(null, formData);
      if (res.ok) {
        setOpen(false);
        showToast(res.message ?? "Payment submitted!", "success");
        router.refresh();
      } else {
        setError(res.error ?? "Could not submit payment.");
        showToast(res.error ?? "Could not submit payment.", "error");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-sm hover:opacity-90"
      >
        <CreditCard className="h-4 w-4" /> Report / Submit Payment
      </button>
    );
  }

  return (
    <form action={onSubmit} className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-sm text-left">
      <h3 className="mb-1 text-base font-semibold">Report Maintenance Payment</h3>
      <p className="mb-4 text-xs text-muted">
        Enter the details of your UPI / bank transfer payment. The committee will verify and credit your flat account.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Amount Paid (₹)
          <input
            name="amount"
            required
            placeholder="e.g. 2500"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Payment Mode
          <select name="mode" defaultValue="upi" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
            <option value="bank">Bank Transfer (NEFT / IMPS)</option>
            <option value="cash">Cash given to Committee</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Date Paid
          <input
            name="paidOn"
            type="date"
            required
            defaultValue={today}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          UTR / Transaction Ref No. (Optional)
          <input
            name="reference"
            placeholder="e.g. 420912389102"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
          Notes / Comments (Optional)
          <input
            name="notes"
            placeholder="e.g. Maintenance payment for July 2026"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-negative">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {pending ? "Submitting…" : "Submit to Committee"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
