import Link from "next/link";
import { getIssues, getIssueCostSummary } from "@/lib/db/queries";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { RaiseIssueForm } from "./RaiseIssueForm";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["open", "acknowledged", "estimating", "approved", "in_progress"]);

export default async function IssuesPage() {
  const [issues, costs] = await Promise.all([getIssues(), getIssueCostSummary()]);
  const costByIssue = new Map(costs.map((c) => [c.issue_id, c]));

  const open = issues.filter((i) => OPEN_STATUSES.has(i.status));
  const done = issues.filter((i) => !OPEN_STATUSES.has(i.status));

  return (
    <>
      <PageHeader
        title="Issues"
        subtitle="Report a problem, follow its progress, and see what repairs are estimated to cost."
      >
        <RaiseIssueForm />
      </PageHeader>

      {issues.length === 0 ? (
        <EmptyState title="No issues yet" hint="Spot something? Raise it and the committee will pick it up." />
      ) : (
        <div className="flex flex-col gap-8">
          <IssueGroup title={`Open (${open.length})`} issues={open} costByIssue={costByIssue} />
          {done.length > 0 && (
            <IssueGroup title={`Closed (${done.length})`} issues={done} costByIssue={costByIssue} />
          )}
        </div>
      )}
    </>
  );
}

function IssueGroup({
  title,
  issues,
  costByIssue,
}: {
  title: string;
  issues: Awaited<ReturnType<typeof getIssues>>;
  costByIssue: Map<string, { approved_estimate_paise: number | null; actual_spent_paise: number }>;
}) {
  if (issues.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {issues.map((issue) => {
          const cost = costByIssue.get(issue.id);
          return (
            <Link key={issue.id} href={`/resident/issues/${issue.id}`}>
              <Card className="flex items-center justify-between gap-4 transition hover:border-primary">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{issue.title}</span>
                    {issue.priority !== "normal" && issue.priority !== "low" && (
                      <Badge value={issue.priority} />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{issue.reference}</span>
                    <span>·</span>
                    <span className="capitalize">{issue.category.replace(/_/g, " ")}</span>
                    {issue.raised_by_name && (
                      <>
                        <span>·</span>
                        <span>{issue.raised_by_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {cost?.approved_estimate_paise != null && (
                    <span className="hidden text-right text-xs text-muted sm:block">
                      <span className="block">Estimate</span>
                      <span className="tabular font-medium text-foreground">
                        {formatPaise(cost.approved_estimate_paise)}
                      </span>
                    </span>
                  )}
                  <Badge value={issue.status} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
