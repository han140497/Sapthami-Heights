"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signUpCommittee } from "./actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    if (formData.get("password") !== formData.get("confirm")) {
      setError("The two passwords don't match.");
      return;
    }
    start(async () => {
      const r = await signUpCommittee(null, formData);
      if (r.ok) setDone(r.message ?? "Account created.");
      else setError(r.error ?? "Could not create the account.");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-5 text-sm">
        <p className="font-medium">Request received</p>
        <p className="mt-1 text-muted">{done}</p>
        <Link href="/committee/login" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:opacity-90">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-negative dark:bg-red-950/40">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/committee/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
