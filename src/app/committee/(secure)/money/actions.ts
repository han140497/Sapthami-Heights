"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, CommitteeAuthError } from "@/lib/supabase/committee";
import { getServiceClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/money";

type ActionResult = { ok: boolean; error?: string; message?: string };

function authError(e: unknown): ActionResult | null {
  if (e instanceof CommitteeAuthError) return { ok: false, error: e.message };
  return null;
}

const paymentSchema = z.object({
  flatId: z.string().uuid(),
  amount: z.string(),
  mode: z.enum(["upi", "bank", "cash", "cheque"]),
  paidOn: z.string(),
  reference: z.string().optional(),
});

/**
 * Record a payment and allocate it against the flat's open invoices, oldest first.
 * The payment lands as 'recorded'. It does NOT touch the ledger yet — an unverified
 * UPI reference is a claim, not money. Verification posts the ledger entry.
 */
export async function recordPayment(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("treasurer", "president", "secretary");
    const parsed = paymentSchema.parse({
      flatId: formData.get("flatId"),
      amount: formData.get("amount"),
      mode: formData.get("mode"),
      paidOn: formData.get("paidOn"),
      reference: formData.get("reference") ?? "",
    });
    const amountPaise = rupeesToPaise(parsed.amount);
    if (amountPaise <= 0) return { ok: false, error: "Amount must be positive." };

    const admin = getServiceClient();
    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        flat_id: parsed.flatId,
        amount_paise: amountPaise,
        mode: parsed.mode,
        paid_on: parsed.paidOn,
        reference: parsed.reference || null,
        status: "recorded",
      })
      .select("id")
      .single();
    if (error || !payment) {
      return {
        ok: false,
        error: error?.code === "23505" ? "This payment reference is already recorded." : "Could not record payment.",
      };
    }

    // Auto-allocate oldest invoice first, up to what each invoice still owes.
    const { data: invoices } = await admin
      .from("invoices")
      .select("id, total_paise, issued_on, payment_allocations(amount_paise)")
      .eq("flat_id", parsed.flatId)
      .is("voided_at", null)
      .order("issued_on");

    let remaining = amountPaise;
    for (const inv of (invoices ?? []) as {
      id: string;
      total_paise: number;
      payment_allocations: { amount_paise: number }[];
    }[]) {
      if (remaining <= 0) break;
      const alreadyPaid = inv.payment_allocations.reduce((a, x) => a + x.amount_paise, 0);
      const outstanding = inv.total_paise - alreadyPaid;
      if (outstanding <= 0) continue;
      const applied = Math.min(outstanding, remaining);
      await admin.from("payment_allocations").insert({
        payment_id: payment.id,
        invoice_id: inv.id,
        amount_paise: applied,
      });
      remaining -= applied;
    }

    revalidatePath("/committee/money");
    return {
      ok: true,
      message: remaining > 0 ? `Recorded. ₹${(remaining / 100).toFixed(2)} left as advance.` : "Payment recorded.",
    };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the details and try again." };
  }
}

/**
 * Verify a recorded payment: mark it verified and post the ledger entry
 * (debit bank/cash, credit the flat's receivable). This is what moves the flat's
 * ledger balance, so it is deliberately a separate, treasurer-level step.
 */
export async function verifyPayment(paymentId: string): Promise<ActionResult> {
  try {
    const identity = await requireRole("treasurer", "president");
    const admin = getServiceClient();

    const { data: payment } = await admin
      .from("payments")
      .select("id, flat_id, amount_paise, mode, status, journal_entry_id, paid_on, flats(number)")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) return { ok: false, error: "Payment not found." };
    if (payment.status === "verified") return { ok: false, error: "Already verified." };
    if (payment.journal_entry_id) return { ok: false, error: "Already posted." };

    const cashAccount = payment.mode === "cash" ? "1010" : "1000";
    const flatNumber = (payment.flats as { number?: string } | null)?.number ?? "";

    const { data: entryId, error: postError } = await admin.rpc("post_journal_entry", {
      p_entry_date: payment.paid_on,
      p_narration: `Payment received — flat ${flatNumber}`,
      p_source_type: "payment",
      p_source_id: paymentId,
      p_lines: [
        { account_code: cashAccount, debit_paise: payment.amount_paise },
        { account_code: "1100", credit_paise: payment.amount_paise, flat_id: payment.flat_id },
      ],
      p_created_by: identity.userId,
    });
    if (postError) return { ok: false, error: postError.message };

    await admin
      .from("payments")
      .update({ status: "verified", journal_entry_id: entryId })
      .eq("id", paymentId);

    revalidatePath("/committee/money");
    revalidatePath("/committee");
    return { ok: true, message: "Payment verified and posted." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not verify." };
  }
}

const expenseSchema = z.object({
  categoryAccountId: z.string().uuid(),
  amount: z.string(),
  description: z.string().min(2).max(200),
  vendor: z.string().optional(),
  spentOn: z.string(),
  paidFrom: z.enum(["bank", "cash"]),
  billRef: z.string().optional(),
  periodId: z.string().uuid().optional().or(z.literal("")),
});

/** Record an expense and post its ledger entry (debit the category, credit bank/cash). */
export async function recordExpense(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireRole("treasurer", "president");
    const parsed = expenseSchema.parse({
      categoryAccountId: formData.get("categoryAccountId"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      vendor: formData.get("vendor") ?? "",
      spentOn: formData.get("spentOn"),
      paidFrom: formData.get("paidFrom"),
      billRef: formData.get("billRef") ?? "",
      periodId: formData.get("periodId") ?? "",
    });
    const amountPaise = rupeesToPaise(parsed.amount);
    if (amountPaise <= 0) return { ok: false, error: "Amount must be positive." };

    const admin = getServiceClient();
    const { data: account } = await admin
      .from("accounts")
      .select("code")
      .eq("id", parsed.categoryAccountId)
      .maybeSingle();
    if (!account) return { ok: false, error: "Unknown expense category." };

    const cashAccount = parsed.paidFrom === "cash" ? "1010" : "1000";
    const { data: entryId, error: postError } = await admin.rpc("post_journal_entry", {
      p_entry_date: parsed.spentOn,
      p_narration: `${parsed.description}${parsed.vendor ? ` — ${parsed.vendor}` : ""}`,
      p_source_type: "expense",
      p_source_id: null,
      p_lines: [
        { account_code: account.code, debit_paise: amountPaise },
        { account_code: cashAccount, credit_paise: amountPaise },
      ],
      p_created_by: identity.userId,
    });
    if (postError) return { ok: false, error: postError.message };

    const { error } = await admin.from("expenses").insert({
      period_id: parsed.periodId || null,
      category_account_id: parsed.categoryAccountId,
      vendor: parsed.vendor || null,
      description: parsed.description,
      amount_paise: amountPaise,
      spent_on: parsed.spentOn,
      paid_from: parsed.paidFrom,
      bill_ref: parsed.billRef || null,
      journal_entry_id: entryId,
      created_by: identity.userId,
    });
    if (error) return { ok: false, error: "Ledger posted but expense record failed — check Books." };

    revalidatePath("/committee/money");
    revalidatePath("/committee");
    return { ok: true, message: "Expense recorded." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the details and try again." };
  }
}
