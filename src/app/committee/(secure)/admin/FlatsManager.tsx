"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Home, X } from "lucide-react";
import { createFlat, updateFlat, setFlatActive, deleteFlat } from "./actions";

const TYPES = ["2BHK", "3BHK", "penthouse"] as const;
const FLOORS = ["G", "1", "2", "3", "4", "PH"] as const;

type Flat = {
  id: string;
  number: string;
  floor: string;
  blockCode: string;
  type: string;
  isActive: boolean;
  residents?: unknown;
};

export function FlatsManager({ flats }: { flats: Flat[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setNotice(r.message ?? null);
        onOk?.();
        router.refresh();
      } else setError(r.error ?? "Something went wrong.");
    });
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Flats ({flats.filter((f) => f.isActive).length} active)</h2>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Home className="h-4 w-4" /> Add flat
        </button>
      </div>

      {open && (
        <form
          action={(fd) => run(() => createFlat(null, fd), () => setOpen(false))}
          className="mb-3 rounded-xl border border-border bg-surface p-4"
        >
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm">
              Block
              <select name="blockCode" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Floor
              <select name="floor" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Number
              <input name="number" required placeholder="A-105" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select name="flatType" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Area sqft (opt)
              <input name="areaSqft" type="number" min={0} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? "Adding…" : "Add flat"}
          </button>
        </form>
      )}

      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      <div className="rounded-xl border border-border bg-surface">
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Flat</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flats.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {editing === f.id ? (
                      <form
                        id={`edit-flat-${f.id}`}
                        action={(fd) => run(() => updateFlat(null, fd), () => setEditing(null))}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="flatId" value={f.id} />
                        <input
                          name="number"
                          defaultValue={f.number}
                          required
                          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm font-medium uppercase"
                        />
                      </form>
                    ) : (
                      f.number
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editing === f.id ? (
                      <div className="flex items-center gap-2">
                        <select form={`edit-flat-${f.id}`} name="flatType" defaultValue={f.type} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
                          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button form={`edit-flat-${f.id}`} type="submit" disabled={pending} className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white">Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted">Cancel</button>
                      </div>
                    ) : (
                      <span className="capitalize text-muted">{f.type}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.isActive ? <span className="text-positive">Active</span> : <span className="text-muted">Inactive</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-3">
                      {editing !== f.id && (
                        <button onClick={() => setEditing(f.id)} className="text-sm text-muted hover:text-foreground">Edit</button>
                      )}
                      <button
                        onClick={() => run(() => setFlatActive(f.id, !f.isActive))}
                        disabled={pending}
                        className="text-sm text-muted hover:text-foreground disabled:opacity-50"
                      >
                        {f.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`Delete ${f.number}? If it has billing history it will be deactivated instead, to protect the books.`)) return;
                            run(() => deleteFlat(f.id));
                        }}
                        disabled={pending}
                        className="text-sm text-negative hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
