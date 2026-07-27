import Link from "next/link";
import { getPeriods } from "@/lib/db/queries";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { CreatePeriodForm } from "./CreatePeriodForm";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function PeriodsPage() {
  const periods = await getPeriods();

  return (
    <>
      <PageHeader title="Billing periods" subtitle="Each month is created, filled with readings and water bills, then closed.">
        <CreatePeriodForm />
      </PageHeader>

      {periods.length === 0 ? (
        <EmptyState title="No periods yet" hint="Create your first billing period to begin." />
      ) : (
        <div className="flex flex-col gap-2">
          {periods.map((p) => (
            <Link key={p.id} href={`/committee/period/${p.id}`}>
              <Card className="flex items-center justify-between transition hover:border-accent">
                <div>
                  <div className="font-medium">{MONTHS[p.month]} {p.year}</div>
                  <div className="text-xs text-muted">
                    Maintenance {formatPaise(p.maintenance_paise)}
                    {p.sinking_fund_paise > 0 && ` + corpus ${formatPaise(p.sinking_fund_paise)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge value={p.status} />
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
