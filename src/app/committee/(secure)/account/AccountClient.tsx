"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // Runs with the member's own session, so they can only change their own password.
      const { error } = await getBrowserClient().auth.updateUser({ password });
      if (error) {
        setError(error.message || "Could not update your password.");
      } else {
        setDone(true);
        setPassword("");
        setConfirm("");
      }
    } catch {
      setError("Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-negative dark:bg-red-950/40">{error}</p>}
      {done && <p className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm">Password updated. Use it next time you sign in.</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
