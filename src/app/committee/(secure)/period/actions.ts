"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCommittee, requireRole, CommitteeAuthError } from "@/lib/supabase/committee";
import { getServiceClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/money";
import { computeWaterPeriod, WaterAllocationError } from "@/lib/water/allocate";

type ActionResult = { ok: boolean; error?: string; message?: string };

function authError(e: unknown): ActionResult | null {
  if (e instanceof CommitteeAuthError) return { ok: false, error: e.message };
  return null;
}

const createSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  maintenance: z.string(),
  sinkingFund: z.string().optional(),
});

export async function createPeriod(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireCommittee();
    const parsed = createSchema.parse({
      year: formData.get("year"),
      month: formData.get("month"),
      maintenance: formData.get("maintenance"),
      sinkingFund: formData.get("sinkingFund") ?? "0",
    });

    const admin = getServiceClient();
    const { error } = await admin.from("billing_periods").insert({
      year: parsed.year,
      month: parsed.month,
      maintenance_paise: rupeesToPaise(parsed.maintenance),
      sinking_fund_paise: parsed.sinkingFund ? rupeesToPaise(parsed.sinkingFund) : 0,
    });
    if (error) {
      return {
        ok: false,
        error: error.code === "23505" ? "That month already exists." : "Could not create the period.",
      };
    }
    revalidatePath("/committee/period");
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the amounts and try again." };
  }
}

const purchaseSchema = z.object({
  periodId: z.string().uuid(),
  sourceType: z.enum(["manjeera", "tanker"]),
  litres: z.coerce.number().int().positive(),
  amount: z.string(),
  purchasedOn: z.string(),
  vendor: z.string().optional(),
  billRef: z.string().optional(),
  // How many identical deliveries to record at once. Tankers arrive in batches — a
  // dozen of the same size and price in a week — so this creates N rows in one go.
  // Each row is independent afterwards and its date/amount can be edited.
  quantity: z.coerce.number().int().min(1).max(100).optional(),
});

export async function addWaterPurchase(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireCommittee();
    const parsed = purchaseSchema.parse({
      periodId: formData.get("periodId"),
      sourceType: formData.get("sourceType"),
      litres: formData.get("litres"),
      amount: formData.get("amount"),
      purchasedOn: formData.get("purchasedOn"),
      vendor: formData.get("vendor") ?? "",
      billRef: formData.get("billRef") ?? "",
      quantity: formData.get("quantity") ?? 1,
    });

    const admin = getServiceClient();
    const count = parsed.quantity ?? 1;
    const row = {
      period_id: parsed.periodId,
      source_type: parsed.sourceType,
      litres: parsed.litres,
      amount_paise: rupeesToPaise(parsed.amount),
      purchased_on: parsed.purchasedOn,
      vendor: parsed.vendor || null,
      bill_ref: parsed.billRef || null,
    };
    const { error } = await admin.from("water_purchases").insert(Array.from({ length: count }, () => ({ ...row })));
    if (error) return { ok: false, error: "Could not add the purchase." };
    revalidatePath(`/committee/period/${parsed.periodId}`);
    return { ok: true, message: count > 1 ? `Added ${count} deliveries. Adjust individual dates below if needed.` : undefined };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the values and try again." };
  }
}

const editPurchaseSchema = z.object({
  purchaseId: z.string().uuid(),
  periodId: z.string().uuid(),
  litres: z.coerce.number().int().positive(),
  amount: z.string(),
  purchasedOn: z.string(),
  vendor: z.string().optional(),
});

/** Edit one water delivery. Only while the period is open — a closed period's
 *  purchases are frozen into its snapshot and must not shift under it. */
export async function editWaterPurchase(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireCommittee();
    const p = editPurchaseSchema.parse({
      purchaseId: formData.get("purchaseId"),
      periodId: formData.get("periodId"),
      litres: formData.get("litres"),
      amount: formData.get("amount"),
      purchasedOn: formData.get("purchasedOn"),
      vendor: formData.get("vendor") ?? "",
    });
    const admin = getServiceClient();
    const { data: period } = await admin.from("billing_periods").select("status").eq("id", p.periodId).maybeSingle();
    if (period?.status !== "open") return { ok: false, error: "Period is closed — its water bills are frozen." };

    const { error } = await admin
      .from("water_purchases")
      .update({
        litres: p.litres,
        amount_paise: rupeesToPaise(p.amount),
        purchased_on: p.purchasedOn,
        vendor: p.vendor || null,
      })
      .eq("id", p.purchaseId);
    if (error) return { ok: false, error: "Could not update the delivery." };
    revalidatePath(`/committee/period/${p.periodId}`);
    return { ok: true, message: "Delivery updated." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the values and try again." };
  }
}

export async function deleteWaterPurchase(periodId: string, purchaseId: string): Promise<ActionResult> {
  try {
    await requireCommittee();
    const admin = getServiceClient();
    // Only allowed while the period is open; a closed period's purchases are history.
    const { data: period } = await admin
      .from("billing_periods")
      .select("status")
      .eq("id", periodId)
      .maybeSingle();
    if (period?.status !== "open") return { ok: false, error: "Period is closed." };
    await admin.from("water_purchases").delete().eq("id", purchaseId);
    revalidatePath(`/committee/period/${periodId}`);
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not delete." };
  }
}

/**
 * Save all meter readings for a period in one go. Consumption is stored, not
 * derived on read, because it gets frozen into the invoice at close. `meter_reset`
 * lets a committee member enter consumption directly when subtraction from the
 * prior reading doesn't apply.
 */
export async function saveReadings(periodId: string, rows: {
  flatId: string;
  consumptionLitres: number;
  readingValue: number;
  isEstimated: boolean;
}[]): Promise<ActionResult> {
  try {
    await requireCommittee();
    const admin = getServiceClient();
    const { data: period } = await admin
      .from("billing_periods")
      .select("status")
      .eq("id", periodId)
      .maybeSingle();
    if (period?.status !== "open") return { ok: false, error: "Period is closed." };

    const records = rows.map((r) => ({
      flat_id: r.flatId,
      period_id: periodId,
      read_on: new Date().toISOString().slice(0, 10),
      reading_value: Math.max(0, Math.round(r.readingValue)),
      consumption_litres: Math.max(0, Math.round(r.consumptionLitres)),
      is_estimated: r.isEstimated,
    }));

    const { error } = await admin
      .from("water_meter_readings")
      .upsert(records, { onConflict: "flat_id,period_id" });
    if (error) return { ok: false, error: "Could not save readings." };
    revalidatePath(`/committee/period/${periodId}`);
    return { ok: true, message: `Saved ${records.length} readings.` };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not save readings." };
  }
}

/**
 * Close a period. This is the money-making moment, so it is restricted to
 * treasurer/president. It computes the water allocation in TypeScript (the fuzz-
 * tested engine), then hands it to close_billing_period, which re-checks the
 * reconciliation in SQL and does the atomic write.
 */
export async function closePeriod(periodId: string): Promise<ActionResult> {
  try {
    const identity = await requireRole("treasurer", "president");
    const admin = getServiceClient();

    const [{ data: purchases }, { data: readings }, { data: flats }] = await Promise.all([
      admin.from("water_purchases").select("source_type, litres, amount_paise").eq("period_id", periodId),
      admin.from("water_meter_readings").select("flat_id, consumption_litres").eq("period_id", periodId),
      admin.from("flats").select("id").eq("is_active", true),
    ]);

    const consumptions = (flats ?? []).map((f) => {
      const r = (readings ?? []).find((x) => x.flat_id === f.id);
      return { flatId: f.id, consumptionLitres: r?.consumption_litres ?? 0 };
    });

    let water;
    try {
      water = computeWaterPeriod(
        (purchases ?? []).map((p) => ({
          sourceType: p.source_type as "manjeera" | "tanker",
          litres: p.litres,
          amountPaise: p.amount_paise,
        })),
        consumptions,
      );
    } catch (e) {
      if (e instanceof WaterAllocationError) return { ok: false, error: e.message };
      throw e;
    }

    const { data, error } = await admin.rpc("close_billing_period", {
      p_period_id: periodId,
      p_water: {
        totalCostPaise: water.totalCostPaise,
        purchasedLitres: water.purchasedLitres,
        meteredLitres: water.meteredLitres,
        lossLitres: water.lossLitres,
        lossPct: water.lossPct,
        blendedRatePaisePerLitre: water.blendedRatePaisePerLitre,
        allocations: water.allocations.map((a) => ({ flatId: a.flatId, amountPaise: a.amountPaise })),
      },
      p_closed_by: identity.userId,
    });

    if (error) return { ok: false, error: error.message };
    revalidatePath("/committee/period");
    revalidatePath(`/committee/period/${periodId}`);
    const result = data as { invoice_count: number; total_billed_paise: number };
    return {
      ok: true,
      message: `Closed. ${result.invoice_count} invoices raised.`,
    };
  } catch (e) {
    return authError(e) ?? { ok: false, error: e instanceof Error ? e.message : "Could not close the period." };
  }
}

export async function reopenPeriod(periodId: string, reason: string): Promise<ActionResult> {
  try {
    const identity = await requireRole("treasurer", "president");
    const admin = getServiceClient();
    const { error } = await admin.rpc("reopen_billing_period", {
      p_period_id: periodId,
      p_reason: reason,
      p_actor: identity.userId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/committee/period");
    revalidatePath(`/committee/period/${periodId}`);
    return { ok: true, message: "Period reopened. Ledger entries reversed." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not reopen." };
  }
}

export async function deleteAllWaterPurchases(periodId: string): Promise<ActionResult> {
  try {
    await requireCommittee();
    const admin = getServiceClient();
    const { data: period } = await admin
      .from("billing_periods")
      .select("status")
      .eq("id", periodId)
      .maybeSingle();
    if (period?.status !== "open") return { ok: false, error: "Period is closed." };
    await admin.from("water_purchases").delete().eq("period_id", periodId);
    revalidatePath(`/committee/period/${periodId}`);
    return { ok: true, message: "All water purchases deleted for this period." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not delete water purchases." };
  }
}

export async function deletePeriod(periodId: string): Promise<ActionResult> {
  try {
    await requireRole("treasurer", "president", "secretary");
    const admin = getServiceClient();
    const { data: period } = await admin
      .from("billing_periods")
      .select("status")
      .eq("id", periodId)
      .maybeSingle();
    if (!period) return { ok: false, error: "Period not found." };
    if (period.status !== "open") {
      return { ok: false, error: "Period is closed. Reopen it first before deleting." };
    }

    // Check if invoices exist
    const { count: invoiceCount } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("period_id", periodId);
    if ((invoiceCount ?? 0) > 0) {
      return { ok: false, error: "Invoices exist for this period. Cannot delete." };
    }

    // Delete child records first
    await admin.from("water_meter_readings").delete().eq("period_id", periodId);
    await admin.from("water_purchases").delete().eq("period_id", periodId);
    await admin.from("water_period_summary").delete().eq("period_id", periodId);
    await admin.from("expenses").update({ period_id: null }).eq("period_id", periodId);
    
    const { error } = await admin.from("billing_periods").delete().eq("id", periodId);
    if (error) return { ok: false, error: "Could not delete the period." };

    revalidatePath("/committee/period");
    return { ok: true, message: "Billing period deleted successfully." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not delete period." };
  }
}

const updateRatesSchema = z.object({
  periodId: z.string().uuid(),
  maintenance: z.string(),
  sinkingFund: z.string().optional(),
});

export async function updatePeriodAmounts(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireCommittee();
    const parsed = updateRatesSchema.parse({
      periodId: formData.get("periodId"),
      maintenance: formData.get("maintenance"),
      sinkingFund: formData.get("sinkingFund") ?? "0",
    });

    const admin = getServiceClient();
    const { data: period } = await admin
      .from("billing_periods")
      .select("status")
      .eq("id", parsed.periodId)
      .maybeSingle();

    if (period?.status !== "open") {
      return { ok: false, error: "Period is closed — rates are frozen." };
    }

    const { error } = await admin
      .from("billing_periods")
      .update({
        maintenance_paise: rupeesToPaise(parsed.maintenance),
        sinking_fund_paise: parsed.sinkingFund ? rupeesToPaise(parsed.sinkingFund) : 0,
      })
      .eq("id", parsed.periodId);

    if (error) return { ok: false, error: "Could not update period rates." };

    revalidatePath("/committee/period");
    revalidatePath(`/committee/period/${parsed.periodId}`);
    return { ok: true, message: "Period rates updated successfully." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check amounts and try again." };
  }
}

