"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { paiseToRupeeInput } from "@/lib/money";
import { verifyPayment, deletePayment, updatePayment } from "./actions";

export type PaymentItem = {
  id: string;
  flat_id: string;
  flat_number?: string;
  amount_paise: number;
  mode: string;
  status: string;
  paid_on: string;
  reference?: string | null;
};

export function PaymentRowActions({
  payment,
  flats,
}: {
  payment: PaymentItem;
  flats: { id: string; number: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onVerify() {
    setError(null);
    start(async () => {
      const res = await verifyPayment(payment.id);
      if (!res.ok) setError(res.error ?? "Could not verify payment.");
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Delete payment of ₹${(payment.amount_paise / 100).toFixed(2)} for ${payment.flat_number ?? "flat"}?`)) return;
    start(async () => {
      const res = await deletePayment(payment.id);
      if (!res.ok) alert(res.error ?? "Could not delete payment.");
      router.refresh();
    });
  }

  function onUpdate(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updatePayment(null, formData);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not update payment.");
      }
    });
  }

  if (editing) {
    return (
      <form action={onUpdate} className="my-2 rounded-lg border border-border bg-surface p-3 text-left shadow-sm">
        <input type="hidden" name="paymentId" value={payment.id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Flat
            <select name="flatId" defaultValue={payment.flat_id} required className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              {flats.map((f) => (
                <option key={f.id} value={f.id}>{f.number}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Amount (₹)
            <input name="amount" required defaultValue={paiseToRupeeInput(payment.amount_paise)} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Payment mode
            <select name="mode" defaultValue={payment.mode} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              <option value="upi">UPI</option>
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Date paid
            <input name="paidOn" type="date" required defaultValue={payment.paid_on} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium sm:col-span-2">
            Reference / UTR (optional)
            <input name="reference" defaultValue={payment.reference ?? ""} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
        </div>
        {error && <p className="mt-1 text-xs text-negative">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="submit" disabled={pending} className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      {payment.status === "recorded" && (
        <button onClick={onVerify} disabled={pending} className="flex items-center gap-1 rounded bg-positive/10 px-2 py-1 font-semibold text-positive hover:bg-positive/20 disabled:opacity-50">
          <CheckCircle className="h-3.5 w-3.5" /> Verify
        </button>
      )}
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-muted hover:text-foreground">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
      <button onClick={onDelete} disabled={pending} className="flex items-center gap-1 text-negative hover:underline disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </div>
  );
}
