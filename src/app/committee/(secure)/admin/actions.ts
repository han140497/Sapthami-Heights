"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, CommitteeAuthError } from "@/lib/supabase/committee";
import { getServiceClient } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string; message?: string };

function authError(e: unknown): ActionResult | null {
  if (e instanceof CommitteeAuthError) return { ok: false, error: e.message };
  return null;
}

const residentSchema = z.object({
  flatId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(10).max(15),
  role: z.enum(["owner", "tenant"]),
  email: z.string().email().optional().or(z.literal("")),
});

/**
 * Register (or replace) the primary resident for a flat. This is what enables that
 * flat to log in — the phone entered here becomes the login credential. Any existing
 * current primary is closed out (to_date set) so the new one is unambiguous.
 */
export async function setPrimaryResident(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("president", "secretary", "treasurer");
    const parsed = residentSchema.parse({
      flatId: formData.get("flatId"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      role: formData.get("role"),
      email: formData.get("email") ?? "",
    });

    const admin = getServiceClient();

    // The DB normalises and validates the phone via a trigger; a bad number throws.
    const { data: resident, error: rErr } = await admin
      .from("residents")
      .insert({ name: parsed.name, phone: parsed.phone, email: parsed.email || null })
      .select("id")
      .single();
    if (rErr || !resident) {
      return {
        ok: false,
        error: rErr?.message?.includes("valid 10-digit")
          ? "That doesn't look like a valid 10-digit mobile number."
          : "Could not save the resident.",
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    // Close out the current primary, if any.
    await admin
      .from("flat_residents")
      .update({ to_date: today })
      .eq("flat_id", parsed.flatId)
      .is("to_date", null)
      .eq("is_primary", true);

    const { error: frErr } = await admin.from("flat_residents").insert({
      flat_id: parsed.flatId,
      resident_id: resident.id,
      role: parsed.role,
      is_primary: true,
      from_date: today,
    });
    if (frErr) return { ok: false, error: "Saved the resident but could not link to the flat." };

    revalidatePath("/committee/admin");
    return { ok: true, message: "Primary resident set. This flat can now log in." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the details and try again." };
  }
}
