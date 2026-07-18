"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleIssueVote } from "./actions";

/**
 * "I'm facing this too" upvote. Used inside issue cards (which are links) and on the
 * detail page, so it stops click propagation to avoid triggering navigation.
 */
export function IssueVoteButton({
  issueId,
  count,
  voted,
  size = "sm",
}: {
  issueId: string;
  count: number;
  voted: boolean;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState({ count, voted });
  const [pending, start] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic toggle for a snappy feel; the server is the source of truth on refresh.
    setOptimistic((s) => ({ voted: !s.voted, count: s.count + (s.voted ? -1 : 1) }));
    start(async () => {
      const r = await toggleIssueVote(issueId);
      if (r.ok) router.refresh();
      else setOptimistic({ count, voted }); // revert on failure
    });
  }

  const big = size === "lg";

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={optimistic.voted}
      title={optimistic.voted ? "You're marked as facing this. Click to remove." : "I'm facing this too"}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border transition disabled:opacity-60",
        big ? "w-16 gap-0.5 px-3 py-2" : "w-12 gap-0 px-2 py-1.5",
        optimistic.voted
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent/60 hover:text-foreground",
      )}
    >
      <ChevronUp className={cn(big ? "h-5 w-5" : "h-4 w-4")} />
      <span className={cn("font-semibold tabular", big ? "text-base" : "text-sm")}>{optimistic.count}</span>
      {big && <span className="text-[10px] font-medium uppercase tracking-wide">facing</span>}
    </button>
  );
}
