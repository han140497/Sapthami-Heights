"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { updateResident, removeResidentFromFlat } from "./actions";

export type ResidentItem = {
  linkId: string;
  residentId: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isPrimary: boolean;
};

export function ResidentActions({
  flatId,
  flatNumber,
  resident,
}: {
  flatId: string;
  flatNumber: string;
  resident: ResidentItem;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onUpdate(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateResident(null, formData);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not update resident.");
      }
    });
  }

  function onRemove() {
    if (!confirm(`Remove ${resident.name} (${resident.role}) from flat ${flatNumber}?`)) return;
    start(async () => {
      const res = await removeResidentFromFlat(flatId, resident.residentId);
      if (!res.ok) alert(res.error ?? "Could not remove resident.");
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form action={onUpdate} className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left shadow-sm">
        <input type="hidden" name="residentId" value={resident.residentId} />
        <input type="hidden" name="flatId" value={flatId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Name
            <input
              name="name"
              required
              defaultValue={resident.name}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Phone (10-digit)
            <input
              name="phone"
              required
              defaultValue={resident.phone}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Role
            <select
              name="role"
              defaultValue={resident.role}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="owner">Owner</option>
              <option value="tenant">Tenant</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium">
            Email (optional)
            <input
              name="email"
              defaultValue={resident.email ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
        </div>
        {error && <p className="text-xs text-negative">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
        title="Edit resident details"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
      <button
        onClick={onRemove}
        disabled={pending}
        className="flex items-center gap-1 text-xs font-medium text-negative hover:underline disabled:opacity-50"
        title="Remove resident from flat"
      >
        <Trash2 className="h-3.5 w-3.5" /> Remove
      </button>
    </div>
  );
}
