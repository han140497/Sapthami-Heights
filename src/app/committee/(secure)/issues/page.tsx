import Link from "next/link";
import { getIssues, getIssueCostSummary } from "@/lib/db/queries";
import { Card, PageHeader, Badge, EmptyState, Money } from "@/components/ui";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["open", "acknowledged", "estimating", "approved", "in_progress"]);

export default async function CommitteeIssuesPage() {
  const [issues, costs] = await Promise.all([getIssues(), getIssueCostSummary()]);
  const costByIssue = new Map(costs.map((c) => [c.issue_id, c]));
  const open = issues.filter((i) => OPEN_STATUSES.has(i.status));
  const closed = issues.filter((i) => !OPEN_STATUSES.has(i.status));

  return (
    <>
      <PageHeader title="Issues" subtitle="Triage what residents raise, add quotes, approve spend, and track estimate vs actual." />
      {issues.length === 0 ? (
        <EmptyState title="No issues raised yet" />
      ) : (
        <div className="flex flex-col gap-8">
          <Group title={`Open (${open.length})`} issues={open} costByIssue={costByIssue} />
          {closed.length > 0 && <Group title={`Closed (${closed.length})`} issues={closed} costByIssue={costByIssue} />}
        </div>
      )}
    </>
  );
}

function Group({
  title,
  issues,
  costByIssue,
}: {
  title: string;
  issues: Awaited<ReturnType<typeof getIssues>>;
  costByIssue: Map<string, { approved_estimate_paise: number | null; actual_spent_paise: number; overrun_paise: number }>;
}) {
  if (issues.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {issues.map((issue) => {
          const cost = costByIssue.get(issue.id);
          return (
            <Link key={issue.id} href={`/committee/issues/${issue.id}`}>
              <Card className="flex items-center justify-between gap-4 transition hover:border-accent">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{issue.title}</span>
                    {(issue.priority === "high" || issue.priority === "urgent") && <Badge value={issue.priority} />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{issue.reference}</span>
                    <span>·</span>
                    <span className="capitalize">{issue.category.replace(/_/g, " ")}</span>
                    {issue.raised_by_name && <><span>·</span><span>{issue.raised_by_name}</span></>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {cost?.approved_estimate_paise != null && (
                    <div className="hidden text-right text-xs sm:block">
                      <span className="block text-muted">Est / Actual</span>
                      <span className="tabular font-medium">
                        <Money paise={cost.approved_estimate_paise} /> / <Money paise={cost.actual_spent_paise} />
                      </span>
                    </div>
                  )}
                  <Badge value={issue.status} />
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
