"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, X } from "lucide-react";
import { createAccount, updateAccount, setAccountActive, deleteAccount } from "./actions";

const TYPES = ["asset", "liability", "income", "expense", "equity"] as const;

type Account = { id: string; code: string; name: string; type: string; isActive: boolean; inUse: boolean };

export function AccountsManager({ accounts }: { accounts: Account[] }) {
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
        <h2 className="text-sm font-semibold">Chart of accounts</h2>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <BookPlus className="h-4 w-4" /> Add account
        </button>
      </div>

      {open && (
        <form
          action={(fd) => run(() => createAccount(null, fd), () => setOpen(false))}
          className="mb-3 rounded-xl border border-border bg-surface p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Code
              <input name="code" required placeholder="5130" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Name
              <input name="name" required placeholder="Common area cleaning" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select name="type" defaultValue="expense" className="rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            The debit/credit side is set automatically from the type (assets &amp; expenses are debit-normal).
          </p>
          <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? "Adding…" : "Add account"}
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
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 tabular font-medium">{a.code}</td>
                  <td className="px-4 py-2.5">
                    {editing === a.id ? (
                      <form
                        action={(fd) => run(() => updateAccount(null, fd), () => setEditing(null))}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="accountId" value={a.id} />
                        <input name="name" defaultValue={a.name} className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
                        <button type="submit" disabled={pending} className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white">Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted">Cancel</button>
                      </form>
                    ) : (
                      a.name
                    )}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-muted">{a.type}</td>
                  <td className="px-4 py-2.5">
                    {a.isActive ? <span className="text-positive">Active</span> : <span className="text-muted">Inactive</span>}
                    {a.inUse && <span className="ml-2 text-xs text-muted">· in use</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-3">
                      {editing !== a.id && (
                        <button onClick={() => setEditing(a.id)} className="text-sm text-muted hover:text-foreground">Rename</button>
                      )}
                      <button onClick={() => run(() => setAccountActive(a.id, !a.isActive))} disabled={pending} className="text-sm text-muted hover:text-foreground disabled:opacity-50">
                        {a.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        onClick={() => {
                          const msg = a.inUse
                            ? `${a.code} has ledger entries and will be deactivated (not deleted) to keep the books intact. Continue?`
                            : `Delete account ${a.code} — ${a.name}?`;
                          if (!confirm(msg)) return; run(() => deleteAccount(a.id));
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
