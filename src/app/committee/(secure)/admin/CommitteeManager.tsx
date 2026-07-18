"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { addCommitteeMember, changeCommitteeRole, endCommitteeTerm } from "./actions";

const ROLES = ["admin", "president", "secretary", "treasurer", "member"] as const;

type Member = { id: string; email: string; role: string; fromDate: string };

export function CommitteeManager({
  members,
  currentUserEmail,
}: {
  members: Member[];
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function addMember(formData: FormData) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await addCommitteeMember(null, formData);
      if (r.ok) {
        setOpen(false);
        setNotice(r.message ?? null);
        router.refresh();
      } else {
        setError(r.error ?? "Could not add the member.");
      }
    });
  }

  function onRoleChange(memberId: string, role: string) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await changeCommitteeRole(memberId, role);
      if (r.ok) {
        setNotice(r.message ?? null);
        router.refresh();
      } else setError(r.error ?? "Could not change the role.");
    });
  }

  function onEndTerm(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from the committee? Their login stays but loses all committee access.`)) return;
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await endCommitteeTerm(memberId);
      if (r.ok) {
        setNotice(r.message ?? null);
        router.refresh();
      } else setError(r.error ?? "Could not remove the member.");
    });
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Committee &amp; roles</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> Add member
        </button>
      </div>

      {open && (
        <form action={addMember} className="mb-3 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Email
              <input name="email" type="email" required placeholder="member@example.com" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Role
              <select name="role" defaultValue="member" className="rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            If this email has no login yet, one is created and a temporary password is shown once.
          </p>
          <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? "Adding…" : "Add to committee"}
          </button>
        </form>
      )}

      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          <span className="text-foreground">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      <div className="rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Member</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Since</th>
              <th className="px-4 py-2 text-right font-medium">Remove</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  {m.email}
                  {m.email === currentUserEmail && <span className="ml-2 text-xs text-muted">(you)</span>}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.role}
                    onChange={(e) => onRoleChange(m.id, e.target.value)}
                    disabled={pending}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm capitalize"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 tabular text-muted">{m.fromDate}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => onEndTerm(m.id, m.email)} disabled={pending} className="text-sm text-negative hover:underline disabled:opacity-50">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
