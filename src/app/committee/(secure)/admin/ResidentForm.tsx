"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { setPrimaryResident } from "./actions";

export function ResidentForm({ flats }: { flats: { id: string; number: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await setPrimaryResident(null, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Could not save the resident.");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
        <UserPlus className="h-4 w-4" /> Set a flat&apos;s resident
      </button>
    );
  }

  return (
    <form action={onSubmit} className="w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-semibold">Set primary resident</h3>
      <p className="mb-3 text-xs text-muted">
        The phone number here is what the resident uses to log in. Setting a new primary retires the
        previous one.
      </p>
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
          Owner or tenant
          <select name="role" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone (10-digit mobile)
          <input name="phone" required inputMode="numeric" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Email (optional)
          <input name="email" type="email" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving…" : "Save resident"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
