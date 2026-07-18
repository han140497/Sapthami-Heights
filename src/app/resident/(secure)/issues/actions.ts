"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentSession } from "@/lib/auth/resident";
import { getServiceClient } from "@/lib/supabase/admin";

const raiseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000),
  category: z.enum([
    "plumbing", "electrical", "lift", "water", "security",
    "housekeeping", "structural", "common_area", "other",
  ]),
  location: z.enum(["flat", "block", "common"]),
});

export async function raiseIssue(_prev: unknown, formData: FormData) {
  const session = await getResidentSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const parsed = raiseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    location: formData.get("location"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Please give a title (3+ characters), category and location." };
  }

  const admin = getServiceClient();
  const { data: created, error } = await admin
    .from("issues")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      location: parsed.data.location,
      flat_id: parsed.data.location === "flat" ? session.flatId : null,
      raised_by_flat_id: session.flatId,
      raised_by_name: `Flat ${session.flatNumber}`,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, error: "Could not raise the issue. Please try again." };

  // Raising it means you're facing it — count the raiser's flat as the first vote, so
  // the tally reads "1 home affected" straight away.
  await admin.from("issue_votes").insert({ issue_id: created.id, flat_id: session.flatId });

  revalidatePath("/resident/issues");
  return { ok: true };
}

/**
 * Toggle the logged-in resident's "I'm facing this too" vote on an issue. Scoped to
 * their flat from the cookie, so a flat can only cast or clear its own vote, and the
 * unique (issue_id, flat_id) constraint means it can never count twice.
 */
export async function toggleIssueVote(issueId: string): Promise<{ ok: boolean; voted?: boolean; error?: string }> {
  const session = await getResidentSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!z.string().uuid().safeParse(issueId).success) return { ok: false, error: "Unknown issue." };

  const admin = getServiceClient();
  const { data: existing } = await admin
    .from("issue_votes")
    .select("id")
    .eq("issue_id", issueId)
    .eq("flat_id", session.flatId)
    .maybeSingle();

  if (existing) {
    await admin.from("issue_votes").delete().eq("id", existing.id);
  } else {
    await admin.from("issue_votes").insert({ issue_id: issueId, flat_id: session.flatId });
  }

  revalidatePath("/resident/issues");
  revalidatePath(`/resident/issues/${issueId}`);
  return { ok: true, voted: !existing };
}

const commentSchema = z.object({
  issueId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

export async function commentOnIssue(_prev: unknown, formData: FormData) {
  const session = await getResidentSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const parsed = commentSchema.safeParse({
    issueId: formData.get("issueId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { ok: false, error: "Comment can't be empty." };

  const admin = getServiceClient();
  const { error } = await admin.from("issue_comments").insert({
    issue_id: parsed.data.issueId,
    author_kind: "resident",
    author_flat_id: session.flatId,
    author_name: `Flat ${session.flatNumber}`,
    body: parsed.data.body,
  });

  if (error) return { ok: false, error: "Could not post the comment." };

  revalidatePath(`/resident/issues/${parsed.data.issueId}`);
  revalidatePath("/resident/issues");
  return { ok: true };
}
