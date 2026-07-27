"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { paiseToRupeeInput } from "@/lib/money";
import { updatePeriodAmounts } from "../actions";

export function EditPeriodRatesForm({
  periodId,
  currentMaintenancePaise,
  currentCorpusPaise,
}: {
  periodId: string;
  currentMaintenancePaise: number;
  currentCorpusPaise: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updatePeriodAmounts(null, formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not update rates.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit rates
      </button>
    );
  }

  return (
    <form action={onSubmit} className="mt-2 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
      <h4 className="mb-2 font-semibold">Edit period rates</h4>
      <input type="hidden" name="periodId" value={periodId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Maintenance per flat (₹)
          <input
            name="maintenance"
            required
            defaultValue={paiseToRupeeInput(currentMaintenancePaise)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Corpus fund per flat (₹, optional)
          <input
            name="sinkingFund"
            defaultValue={paiseToRupeeInput(currentCorpusPaise)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save rates"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
