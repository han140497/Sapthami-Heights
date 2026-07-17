"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCommittee, requireRole, CommitteeAuthError } from "@/lib/supabase/committee";
import { getServiceClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/money";

type ActionResult = { ok: boolean; error?: string; message?: string };

function authError(e: unknown): ActionResult | null {
  if (e instanceof CommitteeAuthError) return { ok: false, error: e.message };
  return null;
}

const STATUSES = [
  "open", "acknowledged", "estimating", "approved",
  "in_progress", "resolved", "closed", "rejected",
] as const;

export async function updateIssueStatus(issueId: string, status: string, priority?: string): Promise<ActionResult> {
  try {
    await requireCommittee();
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { ok: false, error: "Invalid status." };
    const admin = getServiceClient();
    const patch: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") patch.resolved_on = new Date().toISOString().slice(0, 10);
    if (priority) patch.priority = priority;
    const { error } = await admin.from("issues").update(patch).eq("id", issueId);
    if (error) return { ok: false, error: "Could not update." };
    revalidatePath(`/committee/issues/${issueId}`);
    revalidatePath("/committee/issues");
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not update." };
  }
}

const estimateSchema = z.object({
  issueId: z.string().uuid(),
  vendor: z.string().min(1).max(120),
  amount: z.string(),
  description: z.string().max(500).optional(),
});

export async function addEstimate(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireCommittee();
    const parsed = estimateSchema.parse({
      issueId: formData.get("issueId"),
      vendor: formData.get("vendor"),
      amount: formData.get("amount"),
      description: formData.get("description") ?? "",
    });
    const admin = getServiceClient();
    const { error } = await admin.from("issue_estimates").insert({
      issue_id: parsed.issueId,
      vendor: parsed.vendor,
      amount_paise: rupeesToPaise(parsed.amount),
      description: parsed.description ?? "",
      created_by: identity.userId,
    });
    if (error) return { ok: false, error: "Could not add estimate." };
    revalidatePath(`/committee/issues/${parsed.issueId}`);
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the amount and try again." };
  }
}

/** Approve or reject a quote. Approving is president/treasurer only — it is the
 *  committee sanctioning a spend, so it carries the higher bar. */
export async function decideEstimate(estimateId: string, issueId: string, decision: "approved" | "rejected"): Promise<ActionResult> {
  try {
    const identity = decision === "approved"
      ? await requireRole("president", "treasurer")
      : await requireCommittee();
    const admin = getServiceClient();
    const { error } = await admin
      .from("issue_estimates")
      .update({ status: decision, decided_by: identity.userId, decided_at: new Date().toISOString() })
      .eq("id", estimateId);
    if (error) {
      return {
        ok: false,
        error: error.code === "23505" ? "Another quote is already approved for this issue." : "Could not update the quote.",
      };
    }
    revalidatePath(`/committee/issues/${issueId}`);
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not decide." };
  }
}

export async function committeeComment(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireCommittee();
    const issueId = z.string().uuid().parse(formData.get("issueId"));
    const body = z.string().trim().min(1).max(1000).parse(formData.get("body"));
    const admin = getServiceClient();
    const { error } = await admin.from("issue_comments").insert({
      issue_id: issueId,
      author_kind: "committee",
      author_user_id: identity.userId,
      author_name: `Committee (${identity.role})`,
      body,
    });
    if (error) return { ok: false, error: "Could not post." };
    revalidatePath(`/committee/issues/${issueId}`);
    return { ok: true };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not post." };
  }
}
