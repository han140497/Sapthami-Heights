"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, X } from "lucide-react";
import { approvePendingMember, rejectPendingMember } from "./actions";

const ROLES = ["member", "treasurer", "secretary", "president", "admin"] as const;

type Pending = { userId: string; email: string; signedUpAt: string };

export function PendingApprovals({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [pendingTx, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setNotice(r.message ?? null);
        router.refresh();
      } else setError(r.error ?? "Something went wrong.");
    });
  }

  if (pending.length === 0) return null; // nothing awaiting approval

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Pending approvals ({pending.length})</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        These people signed up and are waiting for access. Assign a role to approve, or reject to remove the account.
      </p>

      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      <div className="rounded-xl border border-accent/30 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Signed up</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.userId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">{p.email}</td>
                <td className="px-4 py-2.5 tabular text-muted">{p.signedUpAt || "—"}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={roles[p.userId] ?? "member"}
                    onChange={(e) => setRoles((r) => ({ ...r, [p.userId]: e.target.value }))}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm capitalize"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => run(() => approvePendingMember(p.userId, roles[p.userId] ?? "member"))}
                      disabled={pendingTx}
                      className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { if (confirm(`Reject and delete the account for ${p.email}?`)) run(() => rejectPendingMember(p.userId)); }}
                      disabled={pendingTx}
                      className="text-sm text-negative hover:underline disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
