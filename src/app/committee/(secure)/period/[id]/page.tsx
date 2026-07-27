import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/admin";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { computeWaterPeriod, WaterAllocationError } from "@/lib/water/allocate";
import { ReadingsGrid, type ReadingRow } from "./ReadingsGrid";
import { WaterPurchaseForm } from "./WaterPurchaseForm";
import { CloseButton, ReopenButton } from "./CloseControls";
import { PurchasesList } from "./PurchasesList";
import { EditPeriodRatesForm } from "./EditPeriodRatesForm";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getServiceClient();

  const { data: period } = await admin.from("billing_periods").select("*").eq("id", id).maybeSingle();
  if (!period) notFound();

  const isOpen = period.status === "open";

  const [{ data: flats }, { data: purchases }, { data: readings }] = await Promise.all([
    admin.from("flats").select("id, number").eq("is_active", true).order("number"),
    admin.from("water_purchases").select("*").eq("period_id", id).order("purchased_on"),
    admin.from("water_meter_readings").select("flat_id, reading_value, consumption_litres, is_estimated").eq("period_id", id),
  ]);

  // Prior readings = the most recent reading per flat from an EARLIER period, so the
  // grid can derive consumption by subtraction.
  const { data: priorReadings } = await admin
    .from("water_meter_readings")
    .select("flat_id, reading_value, billing_periods!inner(year, month)")
    .lt("billing_periods.year", period.year + 1);

  const priorByFlat = new Map<string, number>();
  for (const pr of (priorReadings ?? []) as unknown as {
    flat_id: string;
    reading_value: number;
    billing_periods: { year: number; month: number };
  }[]) {
    const earlier =
      pr.billing_periods.year < period.year ||
      (pr.billing_periods.year === period.year && pr.billing_periods.month < period.month);
    if (!earlier) continue;
    priorByFlat.set(pr.flat_id, pr.reading_value); // last wins; readings ordered loosely, acceptable for a hint
  }

  const currentByFlat = new Map((readings ?? []).map((r) => [r.flat_id, r]));

  const rows: ReadingRow[] = (flats ?? []).map((f) => {
    const cur = currentByFlat.get(f.id);
    return {
      flatId: f.id,
      flatNumber: f.number,
      priorReading: priorByFlat.get(f.id) ?? null,
      currentReading: cur?.reading_value ?? null,
      consumption: cur?.consumption_litres ?? null,
      isEstimated: cur?.is_estimated ?? false,
    };
  });

  // Live preview of the water math, so the committee sees the blended rate and any
  // problem BEFORE committing the close.
  let preview: ReturnType<typeof computeWaterPeriod> | null = null;
  let previewError: string | null = null;
  try {
    preview = computeWaterPeriod(
      (purchases ?? []).map((p) => ({
        sourceType: p.source_type as "manjeera" | "tanker",
        litres: p.litres,
        amountPaise: p.amount_paise,
      })),
      rows.map((r) => ({ flatId: r.flatId, consumptionLitres: r.consumption ?? 0 })),
    );
  } catch (e) {
    previewError = e instanceof WaterAllocationError ? e.message : "Could not compute water preview.";
  }

  const flatsWithoutReading = rows.filter((r) => r.consumption == null).length;
  const waterSpent = (purchases ?? []).reduce((a, p) => a + p.amount_paise, 0);
  const blockClose =
    waterSpent > 0 && flatsWithoutReading > 0
      ? `${flatsWithoutReading} flat${flatsWithoutReading === 1 ? "" : "s"} still need a meter reading before you can close.`
      : previewError;

  return (
    <>
      <Link href="/committee/period" className="mb-4 inline-block text-sm text-muted hover:underline">
        ← All periods
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{MONTHS[period.month]} {period.year}</h1>
            <Badge value={period.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Maintenance {formatPaise(period.maintenance_paise)}{period.sinking_fund_paise > 0 ? ` + corpus ${formatPaise(period.sinking_fund_paise)}` : ""} per flat</span>
            {isOpen && (
              <EditPeriodRatesForm
                periodId={id}
                currentMaintenancePaise={period.maintenance_paise}
                currentCorpusPaise={period.sinking_fund_paise}
              />
            )}
          </div>
        </div>
      </div>

      {/* Water purchases */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Water bought this month</h2>
        <PurchasesList periodId={id} purchases={purchases ?? []} editable={isOpen} />
        {isOpen && <WaterPurchaseForm periodId={id} />}
      </section>

      {/* Water preview */}
      {preview && waterSpent > 0 && (
        <section className="mb-8">
          <div className="mb-2.5 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-foreground">
            <span className="font-semibold text-accent">Auto-Adjusted Balance Recovery:</span> Total water purchased into the sump ({(preview.purchasedLitres / 1000).toLocaleString("en-IN")} KL costing {formatPaise(preview.totalCostPaise)}) is automatically balanced against metered flat consumption ({(preview.meteredLitres / 1000).toLocaleString("en-IN")} KL). The unmetered loss/common usage of {(preview.lossLitres / 1000).toLocaleString("en-IN")} KL ({preview.lossPct}%) is automatically absorbed into the blended rate so 100% of the water expenditure is recovered across flats.
          </div>
          <Card className="grid gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase text-muted">Blended rate</div>
              <div className="tabular text-lg font-semibold text-accent">
                ₹{((preview.blendedRatePaisePerLitre * 1000) / 100).toFixed(2)}/KL
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Metered to flats</div>
              <div className="tabular text-lg font-semibold">{(preview.meteredLitres / 1000).toLocaleString("en-IN")} KL</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Unmetered loss</div>
              <div className={`tabular text-lg font-semibold ${preview.lossPct > 10 ? "text-warning" : ""}`}>
                {preview.lossPct}% ({(preview.lossLitres / 1000).toLocaleString("en-IN")} KL)
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Total Recovered</div>
              <div className="tabular text-lg font-semibold text-positive">{formatPaise(preview.totalCostPaise)}</div>
            </div>
          </Card>
        </section>
      )}

      {/* Meter readings */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Meter readings</h2>
        <ReadingsGrid periodId={id} rows={rows} disabled={!isOpen} />
      </section>

      {/* Close / reopen */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{isOpen ? "Close the month" : "Period closed"}</h2>
        {isOpen ? (
          <CloseButton periodId={id} blocked={blockClose} />
        ) : (
          <Card className="flex flex-col gap-3">
            <p className="text-sm text-positive">
              This period is closed. {(readings ?? []).length} readings and its water summary are frozen; bills have been raised.
            </p>
            <ReopenButton periodId={id} />
          </Card>
        )}
      </section>
    </>
  );
}
