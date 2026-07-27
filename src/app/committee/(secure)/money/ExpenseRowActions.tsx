"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { paiseToRupeeInput } from "@/lib/money";
import { deleteExpense, updateExpense } from "./actions";

export type ExpenseItem = {
  id: string;
  category_account_id: string;
  amount_paise: number;
  description: string;
  vendor?: string | null;
  spent_on: string;
  paid_from: string;
  bill_ref?: string | null;
  period_id?: string | null;
};

export function ExpenseRowActions({
  expense,
  accounts,
  periods,
}: {
  expense: ExpenseItem;
  accounts: { id: string; code: string; name: string }[];
  periods: { id: string; month: number; year: number }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function onDelete() {
    if (!confirm(`Delete expense "${expense.description}" of ₹${(expense.amount_paise / 100).toFixed(2)}? This will reverse its ledger entry.`)) return;
    start(async () => {
      const res = await deleteExpense(expense.id);
      if (!res.ok) alert(res.error ?? "Could not delete expense.");
      router.refresh();
    });
  }

  function onUpdate(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateExpense(null, formData);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not update expense.");
      }
    });
  }

  if (editing) {
    return (
      <form action={onUpdate} className="my-2 rounded-lg border border-border bg-surface p-3 text-left shadow-sm">
        <input type="hidden" name="expenseId" value={expense.id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Category
            <select name="categoryAccountId" defaultValue={expense.category_account_id} required className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Amount (₹)
            <input name="amount" required defaultValue={paiseToRupeeInput(expense.amount_paise)} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium sm:col-span-2">
            Description
            <input name="description" required defaultValue={expense.description} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Vendor / Payee
            <input name="vendor" defaultValue={expense.vendor ?? ""} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Date spent
            <input name="spentOn" type="date" required defaultValue={expense.spent_on} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Paid from
            <select name="paidFrom" defaultValue={expense.paid_from} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              <option value="bank">Bank account</option>
              <option value="cash">Petty cash</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Tag to billing period
            <select name="periodId" defaultValue={expense.period_id ?? ""} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              <option value="">General (No period tag)</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{MONTHS[p.month]} {p.year}</option>
              ))}
            </select>
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
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-muted hover:text-foreground">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
      <button onClick={onDelete} disabled={pending} className="flex items-center gap-1 text-negative hover:underline disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </div>
  );
}
