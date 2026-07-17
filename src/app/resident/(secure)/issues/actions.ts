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
  const { error } = await admin.from("issues").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    location: parsed.data.location,
    flat_id: parsed.data.location === "flat" ? session.flatId : null,
    raised_by_flat_id: session.flatId,
    raised_by_name: `Flat ${session.flatNumber}`,
  });

  if (error) return { ok: false, error: "Could not raise the issue. Please try again." };

  revalidatePath("/resident/issues");
  return { ok: true };
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
