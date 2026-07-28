import { getResidentSession } from "@/lib/auth/resident";
import {
  getWaterTransparency,
  getFlatWaterHistory,
  getFlatWaterCharges,
} from "@/lib/db/queries";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { Droplets, TrendingDown } from "lucide-react";

import { WaterTrendChart } from "./WaterTrendChart";

export const dynamic = "force-dynamic";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ratePerKl(paisePerLitre: number): string {
  return `₹${((paisePerLitre * 1000) / 100).toFixed(2)}/KL`;
}

export default async function MyWaterPage() {
  const session = await getResidentSession();
  if (!session) return null;

  const [periods, myReadings, myCharges] = await Promise.all([
    getWaterTransparency(),
    getFlatWaterHistory(session.flatId),
    getFlatWaterCharges(session.flatId),
  ]);

  const readingByPeriod = new Map(
    myReadings.map((r) => [r.period_id as string, r]),
  );

  const trendData = [...periods].slice(0, 6).reverse().map((p) => {
    const mine = readingByPeriod.get(p.period_id) as
      | { consumption_litres: number; is_estimated: boolean }
      | undefined;
    return {
      periodLabel: `${MONTHS[p.month]}`,
      litres: mine?.consumption_litres ?? 0,
      isEstimated: mine?.is_estimated ?? false,
    };
  });

  return (
    <>
      <PageHeader
        title="Water charges, in full"
        subtitle="Sapthami Heights mixes Manjeera municipal water with tanker deliveries in one sump. Here is exactly how each month's rate was worked out — and your share."
      />

      <WaterTrendChart trend={trendData} />

      {periods.length === 0 ? (
        <EmptyState
          title="No closed water periods yet"
          hint="Once the committee closes a month with water readings, the full breakdown shows here."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {periods.map((p) => {
            const mine = readingByPeriod.get(p.period_id) as
              | { consumption_litres: number; is_estimated: boolean }
              | undefined;
            const myLitres = mine?.consumption_litres ?? 0;
            // The exact amount from the bill, never a recomputation of it.
            const myCharge = myCharges.get(p.period_id) ?? 0;
            return (
              <Card key={p.period_id}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Droplets className="h-5 w-5 text-accent" />
                    {MONTHS[p.month]} {p.year}
                  </h2>
                  {p.loss_pct > 10 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-warning">
                      <TrendingDown className="h-4 w-4" />
                      High loss — possible leak
                    </span>
                  )}
                </div>

                {/* The derivation chain: sources -> blended rate -> your share. */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">
                      What the society bought
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      {p.manjeera_litres > 0 && (
                        <div className="flex justify-between">
                          <span>Manjeera {(p.manjeera_litres / 1000).toLocaleString("en-IN")} KL</span>
                          <span className="tabular text-muted">
                            {p.manjeera_rate_paise_per_litre != null
                              ? ratePerKl(p.manjeera_rate_paise_per_litre)
                              : "—"}
                          </span>
                        </div>
                      )}
                      {p.tanker_litres > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Tankers {(p.tanker_litres / 1000).toLocaleString("en-IN")} KL
                            <span className="text-muted"> ({p.tanker_delivery_count})</span>
                          </span>
                          <span className="tabular text-muted">
                            {p.tanker_rate_paise_per_litre != null
                              ? ratePerKl(p.tanker_rate_paise_per_litre)
                              : "—"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-border pt-1 font-medium">
                        <span>Total spent</span>
                        <span className="tabular">{formatPaise(p.total_cost_paise)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">
                      The blended rate
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Metered to flats</span>
                        <span className="tabular">{(p.metered_litres / 1000).toLocaleString("en-IN")} KL</span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>Unaccounted (loss)</span>
                        <span className="tabular">
                          {(p.loss_litres / 1000).toLocaleString("en-IN")} KL · {p.loss_pct}%
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1 font-semibold text-accent">
                        <span>Blended rate</span>
                        <span className="tabular">{ratePerKl(p.blended_rate_paise_per_litre)}</span>
                      </div>
                      <p className="pt-1 text-xs text-muted">
                        Total spent ÷ metered litres, so the society recovers every rupee. Loss is
                        shared by usage.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/20">
                    <div className="text-xs font-medium uppercase tracking-wide text-primary">
                      Your flat {session.flatNumber}
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>You used</span>
                        <span className="tabular">
                          {(myLitres / 1000).toLocaleString("en-IN")} KL
                        </span>
                      </div>
                      {mine?.is_estimated && (
                        <div className="pt-0.5"><Badge value="estimated" /></div>
                      )}
                      <div className="flex justify-between border-t border-border pt-1 font-semibold">
                        <span>Your water charge</span>
                        <span className="tabular">{formatPaise(myCharge)}</span>
                      </div>
                      <p className="pt-1 text-xs text-muted">
                        {(myLitres / 1000).toLocaleString("en-IN")} KL × {ratePerKl(p.blended_rate_paise_per_litre)}.
                        Shown on your bill for this month.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
