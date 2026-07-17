"use client";

import { useActionState, useEffect, useRef } from "react";
import { commentOnIssue } from "../actions";

export function CommentForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(commentOnIssue, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="issueId" value={issueId} />
      <textarea
        name="body"
        rows={2}
        required
        maxLength={1000}
        placeholder="Add a comment…"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {state && !state.ok && <p className="text-sm text-negative">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
