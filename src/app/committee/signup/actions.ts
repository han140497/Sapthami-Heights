"use server";

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { hashClientIp } from "@/lib/auth/resident";

type ActionResult = { ok: boolean; error?: string; message?: string };

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters."),
});

/**
 * Public committee self-signup. Creates a Supabase Auth user with the password the
 * person chooses — but NO committee seat, so the account can see nothing until an
 * admin approves it. Rate-limited per IP because this is an unauthenticated endpoint
 * that creates auth users; the approval step is the real access gate.
 */
export async function signUpCommittee(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }

  const admin = getServiceClient();
  const ipHash = await hashClientIp();

  const { data: throttled } = await admin.rpc("committee_signup_is_throttled", { p_ip_hash: ipHash });
  if (throttled) {
    return { ok: false, error: "Too many signups from here. Please try again later." };
  }

  // Record the attempt before creating, so even failures count against the limit.
  await admin.from("committee_signup_attempts").insert({ ip_hash: ipHash, email: parsed.data.email });

  // email_confirm: true — no confirmation email is sent (the committee chose not to
  // depend on email), and the account is immediately usable for sign-in. It simply
  // has no committee access until approved.
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error) {
    const already = error.message?.toLowerCase().includes("already") || error.status === 422;
    return {
      ok: false,
      error: already
        ? "An account with that email already exists. Try signing in, or ask an admin."
        : "Could not create the account. Please try again.",
    };
  }

  return {
    ok: true,
    message: "Account created. You can sign in now, but a committee admin must approve you before you can access anything.",
  };
}
