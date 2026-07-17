import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue, getIssueCostSummary } from "@/lib/db/queries";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { StatusControl, AddEstimateForm, EstimateDecision } from "../IssueControls";

export const dynamic = "force-dynamic";

export default async function CommitteeIssueDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ issue, estimates, comments }, costs] = await Promise.all([getIssue(id), getIssueCostSummary()]);
  if (!issue) notFound();
  const cost = costs.find((c) => c.issue_id === id);

  return (
    <>
      <Link href="/committee/issues" className="mb-4 inline-block text-sm text-muted hover:underline">
        ← All issues
      </Link>
      <PageHeader title={issue.title} subtitle={`${issue.reference} · ${issue.category.replace(/_/g, " ")} · raised by ${issue.raised_by_name ?? "a resident"}`}>
        <Badge value={issue.status} />
      </PageHeader>

      <Card className="mb-6">
        <StatusControl issueId={id} status={issue.status} priority={issue.priority} />
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
                    {(c.author_kind as string) === "committee" && <Badge value="committee" className="ml-2" />}
                  </span>
                  <span className="text-xs text-muted">{new Date(c.created_at as string).toLocaleDateString("en-IN")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.body as string}</p>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Cost tracking</h2>
          <Card className="mb-4 flex flex-col gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Approved estimate</div>
              <div className="tabular text-xl font-semibold">
                {cost?.approved_estimate_paise != null ? formatPaise(cost.approved_estimate_paise) : "—"}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-xs uppercase tracking-wide text-muted">Actually spent</div>
              <div className="tabular text-xl font-semibold">{formatPaise(cost?.actual_spent_paise ?? 0)}</div>
              {cost && cost.overrun_paise > 0 && (
                <div className="text-xs text-negative">{formatPaise(cost.overrun_paise)} over estimate</div>
              )}
            </div>
          </Card>

          <h3 className="mb-2 text-sm font-semibold">Quotes</h3>
          <div className="mb-3 flex flex-col gap-2">
            {estimates.length === 0 && <p className="text-sm text-muted">No quotes yet.</p>}
            {estimates.map((e) => (
              <Card key={e.id as string} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{e.vendor as string}</div>
                  <div className="tabular text-sm">{formatPaise(e.amount_paise as number)}</div>
                  {(e.description as string) && <div className="text-xs text-muted">{e.description as string}</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge value={e.status as string} />
                  <EstimateDecision estimateId={e.id as string} issueId={id} status={e.status as string} />
                </div>
              </Card>
            ))}
          </div>
          <AddEstimateForm issueId={id} />
        </div>
      </div>
    </>
  );
}
