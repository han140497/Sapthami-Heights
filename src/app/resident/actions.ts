"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentSession } from "@/lib/auth/resident";
import { getServiceClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/money";

type ActionResult = { ok: boolean; error?: string; message?: string };

const residentPaymentSchema = z.object({
  amount: z.string(),
  mode: z.enum(["upi", "bank", "cash", "cheque"]),
  paidOn: z.string(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function submitResidentPaymentClaim(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const session = await getResidentSession();
    if (!session) return { ok: false, error: "Not logged in as a resident." };

    const parsed = residentPaymentSchema.parse({
      amount: formData.get("amount"),
      mode: formData.get("mode"),
      paidOn: formData.get("paidOn"),
      reference: formData.get("reference") ?? "",
      notes: formData.get("notes") ?? "",
    });

    const amountPaise = rupeesToPaise(parsed.amount);
    if (amountPaise <= 0) return { ok: false, error: "Amount must be positive." };

    const admin = getServiceClient();

    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        flat_id: session.flatId,
        amount_paise: amountPaise,
        mode: parsed.mode,
        paid_on: parsed.paidOn,
        reference: parsed.reference || null,
        notes: parsed.notes || "Submitted by resident",
        status: "recorded",
      })
      .select("id")
      .single();

    if (error || !payment) {
      return {
        ok: false,
        error: error?.code === "23505" ? "This payment reference/UTR was already submitted." : "Could not submit payment claim.",
      };
    }

    // Auto-allocate against open invoices
    const { data: invoices } = await admin
      .from("invoices")
      .select("id, total_paise, issued_on, payment_allocations(amount_paise)")
      .eq("flat_id", session.flatId)
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

    revalidatePath("/resident");
    revalidatePath("/committee/money");
    revalidatePath("/committee");
    return { ok: true, message: "Payment details submitted to the committee for verification!" };
  } catch (e) {
    return { ok: false, error: "Check details and try again." };
  }
}
