"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPeriod } from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CreatePeriodForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = new Date();

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await createPeriod(null, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Could not create the period.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> New period
      </button>
    );
  }

  return (
    <form action={onSubmit} className="w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-semibold">Open a new billing period</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Month
          <select name="month" defaultValue={now.getMonth() + 1} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Year
          <input name="year" type="number" defaultValue={now.getFullYear()} min={2020} max={2100} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Maintenance per flat (₹)
          <input name="maintenance" required placeholder="e.g. 2500" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sinking fund per flat (₹, optional)
          <input name="sinkingFund" placeholder="e.g. 500" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? "Creating…" : "Create period"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
