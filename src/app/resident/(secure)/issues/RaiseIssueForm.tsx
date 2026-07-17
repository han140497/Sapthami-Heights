"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { raiseIssue } from "./actions";

const CATEGORIES = [
  "plumbing", "electrical", "lift", "water", "security",
  "housekeeping", "structural", "common_area", "other",
];

export function RaiseIssueForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await raiseIssue(null, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Could not raise the issue.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Raise an issue
      </button>
    );
  }

  return (
    <form action={onSubmit} className="w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-semibold">Raise a new issue</h3>
      <div className="flex flex-col gap-3">
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder="Short title (e.g. Lift making noise on B block)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="What's happening? Any detail helps the committee."
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="category" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Category…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select name="location" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Where?</option>
            <option value="flat">Inside my flat</option>
            <option value="block">My block</option>
            <option value="common">Common area</option>
          </select>
        </div>
        {error && <p className="text-sm text-negative">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
