import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue, getIssueCostSummary, getIssueVotes } from "@/lib/db/queries";
import { getResidentSession } from "@/lib/auth/resident";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { CommentForm } from "./CommentForm";
import { IssueVoteButton } from "../IssueVoteButton";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getResidentSession();
  const [{ issue, estimates, comments }, costs, votes] = await Promise.all([
    getIssue(id),
    getIssueCostSummary(),
    getIssueVotes(session?.flatId),
  ]);
  if (!issue) notFound();

  const cost = costs.find((c) => c.issue_id === id);
  const approved = estimates.find((e) => e.status === "approved");
  const vote = votes.get(id) ?? { count: 0, voted: false };

  return (
    <>
      <Link href="/resident/issues" className="mb-4 inline-block text-sm text-muted hover:underline">
        ← All issues
      </Link>
      <PageHeader title={issue.title} subtitle={`${issue.reference} · raised by ${issue.raised_by_name ?? "a resident"}`}>
        <Badge value={issue.status} />
      </PageHeader>

      <Card className="mb-4 flex items-center gap-4">
        <IssueVoteButton issueId={id} count={vote.count} voted={vote.voted} size="lg" />
        <div className="text-sm">
          <p className="font-medium">
            {vote.count === 0
              ? "No one has marked this yet"
              : `${vote.count} ${vote.count === 1 ? "home is" : "homes are"} facing this`}
          </p>
          <p className="text-muted">
            {vote.voted
              ? "You've marked your flat as affected. Tap the arrow to undo."
              : "Facing the same problem? Tap the arrow so the committee knows how many are affected."}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {issue.description && (
            <Card className="mb-4">
              <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
            </Card>
          )}

          <h2 className="mb-2 mt-6 text-lg font-semibold">Discussion</h2>
          <div className="flex flex-col gap-3">
            {comments.length === 0 && <EmptyState title="No comments yet" />}
            {comments.map((c) => (
              <Card key={c.id as string} className="py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {c.author_name as string}
                    {(c.author_kind as string) === "committee" && (
                      <Badge value="committee" className="ml-2" />
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(c.created_at as string).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.body as string}</p>
              </Card>
            ))}
          </div>

          <div className="mt-4">
            <CommentForm issueId={id} />
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Cost</h2>
          <Card className="flex flex-col gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Approved estimate</div>
              <div className="tabular text-xl font-semibold">
                {approved ? formatPaise(approved.amount_paise as number) : "—"}
              </div>
              {approved && (
                <div className="text-xs text-muted">{approved.vendor as string}</div>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-xs uppercase tracking-wide text-muted">Actually spent</div>
              <div className="tabular text-xl font-semibold">
                {formatPaise(cost?.actual_spent_paise ?? 0)}
              </div>
              {cost && cost.overrun_paise > 0 && (
                <div className="text-xs text-negative">
                  {formatPaise(cost.overrun_paise)} over estimate
                </div>
              )}
            </div>
          </Card>

          {estimates.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">All quotes</h3>
              <div className="flex flex-col gap-2">
                {estimates.map((e) => (
                  <Card key={e.id as string} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium">{e.vendor as string}</div>
                      <div className="tabular text-sm">{formatPaise(e.amount_paise as number)}</div>
                    </div>
                    <Badge value={e.status as string} />
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
