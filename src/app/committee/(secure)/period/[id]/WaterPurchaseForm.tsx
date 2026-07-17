"use client";

import { useActionState, useEffect, useRef } from "react";
import { addWaterPurchase } from "../actions";

export function WaterPurchaseForm({ periodId }: { periodId: string }) {
  const [state, action, pending] = useActionState(addWaterPurchase, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-xl border border-border bg-surface p-4">
      <input type="hidden" name="periodId" value={periodId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Source
          <select name="sourceType" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="manjeera">Manjeera (municipal)</option>
            <option value="tanker">Tanker</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Litres
          <input name="litres" type="number" required min={1} placeholder="e.g. 10000" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount (₹)
          <input name="amount" required placeholder="e.g. 1800" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input name="purchasedOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Vendor (optional)
          <input name="vendor" placeholder="Tanker supplier / Water board" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bill ref (optional)
          <input name="billRef" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {state && !state.ok && <p className="mt-2 text-sm text-negative">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
        {pending ? "Adding…" : "Add water bill"}
      </button>
    </form>
  );
}
