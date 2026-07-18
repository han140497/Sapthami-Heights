"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireAdmin, CommitteeAuthError } from "@/lib/supabase/committee";
import { getServiceClient } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string; message?: string };

function authError(e: unknown): ActionResult | null {
  if (e instanceof CommitteeAuthError) return { ok: false, error: e.message };
  return null;
}

// ---------------------------------------------------------------------------
// Residents (available to any committee member — this is how a flat gets a login).
// ---------------------------------------------------------------------------

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

/**
 * Remove the current primary resident registered to a flat. This is what was missing:
 * once set, there was no way to take a resident off a flat. It ends the flat link and
 * deletes the resident record if nothing else references it (a wrongly-added resident
 * has no financial history — flats are billed, not people — so this is a safe delete).
 * The flat can log in again only once a new primary resident is set.
 */
export async function removePrimaryResident(flatId: string): Promise<ActionResult> {
  try {
    await requireRole("president", "secretary", "treasurer");
    const admin = getServiceClient();

    const { data: current } = await admin
      .from("flat_residents")
      .select("id, resident_id")
      .eq("flat_id", flatId)
      .is("to_date", null)
      .eq("is_primary", true)
      .maybeSingle();
    if (!current) return { ok: false, error: "This flat has no registered resident to remove." };

    // FK order: flat_residents references residents (ON DELETE RESTRICT), so the link
    // must go before the resident row.
    await admin.from("flat_residents").delete().eq("id", current.id);

    // Delete the resident only if no other flat still links to them.
    const { count } = await admin
      .from("flat_residents")
      .select("id", { count: "exact", head: true })
      .eq("resident_id", current.resident_id);
    if ((count ?? 0) === 0) {
      await admin.from("residents").delete().eq("id", current.resident_id);
    }

    revalidatePath("/committee/admin");
    return { ok: true, message: "Resident removed. This flat can no longer log in until a new resident is set." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not remove the resident." };
  }
}

// ---------------------------------------------------------------------------
// Vehicles (Admin can manage any flat's). Residents manage their own flat's via the
// resident app; this is the committee-side view across the whole society.
// ---------------------------------------------------------------------------

const adminVehicleSchema = z.object({
  flatId: z.string().uuid(),
  vehicleType: z.enum(["car", "bike", "scooter", "bicycle", "other"]),
  registrationNumber: z.string().trim().min(1).max(20),
  makeModel: z.string().trim().max(80).optional(),
  parkingSlot: z.string().trim().max(20).optional(),
});

export async function addVehicleForFlat(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("president", "secretary", "treasurer");
    const p = adminVehicleSchema.parse({
      flatId: formData.get("flatId"),
      vehicleType: formData.get("vehicleType"),
      registrationNumber: formData.get("registrationNumber"),
      makeModel: formData.get("makeModel") ?? "",
      parkingSlot: formData.get("parkingSlot") ?? "",
    });
    const admin = getServiceClient();
    const { error } = await admin.from("vehicles").insert({
      flat_id: p.flatId,
      vehicle_type: p.vehicleType,
      registration_number: p.registrationNumber,
      make_model: p.makeModel || null,
      parking_slot: p.parkingSlot || null,
    });
    if (error) {
      return { ok: false, error: error.code === "23505" ? "That registration number is already registered." : "Could not add the vehicle." };
    }
    revalidatePath("/committee/admin");
    return { ok: true, message: "Vehicle added." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the vehicle details and try again." };
  }
}

export async function removeVehicleAsAdmin(vehicleId: string): Promise<ActionResult> {
  try {
    await requireRole("president", "secretary", "treasurer");
    const admin = getServiceClient();
    const { error } = await admin.from("vehicles").delete().eq("id", vehicleId);
    if (error) return { ok: false, error: "Could not remove the vehicle." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Vehicle removed." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not remove the vehicle." };
  }
}

// ---------------------------------------------------------------------------
// Flats (Admin only). Deletes protect the audit trail: a flat that has ANY
// financial history is deactivated, never destroyed, so past invoices and the
// ledger keep referring to a real row.
// ---------------------------------------------------------------------------

const flatSchema = z.object({
  blockCode: z.enum(["A", "B"]),
  floor: z.enum(["G", "1", "2", "3", "4", "PH"]),
  number: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  flatType: z.enum(["2BHK", "3BHK", "penthouse"]),
  areaSqft: z.coerce.number().int().positive().optional().or(z.literal(0)),
});

export async function createFlat(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = flatSchema.parse({
      blockCode: formData.get("blockCode"),
      floor: formData.get("floor"),
      number: formData.get("number"),
      flatType: formData.get("flatType"),
      areaSqft: formData.get("areaSqft") || 0,
    });
    const admin = getServiceClient();
    const { data: block } = await admin.from("blocks").select("id").eq("code", p.blockCode).maybeSingle();
    if (!block) return { ok: false, error: `Block ${p.blockCode} not found.` };

    const { error } = await admin.from("flats").insert({
      block_id: block.id,
      floor: p.floor,
      number: p.number.toUpperCase(),
      flat_type: p.flatType,
      area_sqft: p.areaSqft || null,
    });
    if (error) {
      return { ok: false, error: error.code === "23505" ? `Flat ${p.number} already exists.` : "Could not create the flat." };
    }
    revalidatePath("/committee/admin");
    return { ok: true, message: `Flat ${p.number.toUpperCase()} added.` };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the flat details and try again." };
  }
}

const flatEditSchema = z.object({
  flatId: z.string().uuid(),
  flatType: z.enum(["2BHK", "3BHK", "penthouse"]),
  areaSqft: z.coerce.number().int().nonnegative().optional(),
});

export async function updateFlat(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = flatEditSchema.parse({
      flatId: formData.get("flatId"),
      flatType: formData.get("flatType"),
      areaSqft: formData.get("areaSqft") || 0,
    });
    const admin = getServiceClient();
    const { error } = await admin
      .from("flats")
      .update({ flat_type: p.flatType, area_sqft: p.areaSqft || null })
      .eq("id", p.flatId);
    if (error) return { ok: false, error: "Could not update the flat." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Flat updated." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not update the flat." };
  }
}

/** True if this flat has any financial history that must not be orphaned. */
async function flatHasHistory(flatId: string): Promise<boolean> {
  const admin = getServiceClient();
  for (const table of ["invoices", "payments", "water_meter_readings"] as const) {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("flat_id", flatId);
    if ((count ?? 0) > 0) return true;
  }
  const { count: ledger } = await admin
    .from("journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("flat_id", flatId);
  return (ledger ?? 0) > 0;
}

export async function setFlatActive(flatId: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = getServiceClient();
    const { error } = await admin.from("flats").update({ is_active: active }).eq("id", flatId);
    if (error) return { ok: false, error: "Could not update the flat." };
    revalidatePath("/committee/admin");
    return { ok: true, message: active ? "Flat reactivated." : "Flat deactivated — it will be left out of future billing." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not update the flat." };
  }
}

export async function deleteFlat(flatId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    // Audit-trail rule: a flat with any money against it is deactivated, not deleted.
    if (await flatHasHistory(flatId)) {
      const admin = getServiceClient();
      await admin.from("flats").update({ is_active: false }).eq("id", flatId);
      revalidatePath("/committee/admin");
      return {
        ok: true,
        message: "This flat has billing history, so it was deactivated rather than deleted. Its past invoices and ledger stay intact.",
      };
    }
    const admin = getServiceClient();
    // Remove any resident links first (no history means these are just registrations).
    await admin.from("flat_residents").delete().eq("flat_id", flatId);
    const { error } = await admin.from("flats").delete().eq("id", flatId);
    if (error) return { ok: false, error: "Could not delete the flat." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Flat deleted." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not delete the flat." };
  }
}

// ---------------------------------------------------------------------------
// Chart of accounts (Admin only). An account with posted journal lines cannot be
// deleted — that would orphan ledger history — it can only be deactivated.
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  code: z.string().trim().min(1).max(10).regex(/^[0-9]+$/, "Account code must be digits, e.g. 5130"),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["asset", "liability", "income", "expense", "equity"]),
});

const NORMAL_SIDE: Record<string, "debit" | "credit"> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  income: "credit",
  equity: "credit",
};

export async function createAccount(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = accountSchema.parse({
      code: formData.get("code"),
      name: formData.get("name"),
      type: formData.get("type"),
    });
    const admin = getServiceClient();
    const { error } = await admin.from("accounts").insert({
      code: p.code,
      name: p.name,
      type: p.type,
      normal_side: NORMAL_SIDE[p.type],
    });
    if (error) {
      return { ok: false, error: error.code === "23505" ? `Account code ${p.code} already exists.` : "Could not create the account." };
    }
    revalidatePath("/committee/admin");
    return { ok: true, message: `Account ${p.code} — ${p.name} added.` };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the account details and try again." };
  }
}

export async function updateAccount(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = z.string().uuid().parse(formData.get("accountId"));
    const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
    const admin = getServiceClient();
    // The code, type and normal_side are the account's identity in the ledger and are
    // deliberately not editable here — changing them would silently restate history.
    const { error } = await admin.from("accounts").update({ name }).eq("id", id);
    if (error) return { ok: false, error: "Could not update the account." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Account renamed." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not update the account." };
  }
}

export async function setAccountActive(accountId: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = getServiceClient();
    const { error } = await admin.from("accounts").update({ is_active: active }).eq("id", accountId);
    if (error) return { ok: false, error: "Could not update the account." };
    revalidatePath("/committee/admin");
    return { ok: true, message: active ? "Account reactivated." : "Account deactivated." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not update the account." };
  }
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = getServiceClient();
    const { count } = await admin
      .from("journal_lines")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);
    if ((count ?? 0) > 0) {
      await admin.from("accounts").update({ is_active: false }).eq("id", accountId);
      revalidatePath("/committee/admin");
      return {
        ok: true,
        message: "This account has ledger entries, so it was deactivated rather than deleted, keeping the books intact.",
      };
    }
    const { error } = await admin.from("accounts").delete().eq("id", accountId);
    if (error) return { ok: false, error: "Could not delete the account." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Account deleted." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not delete the account." };
  }
}

// ---------------------------------------------------------------------------
// Committee members & roles (Admin only).
// ---------------------------------------------------------------------------

const committeeSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "president", "secretary", "treasurer", "member"]),
});

/**
 * Add a committee member by email. If no auth user exists for that email one is
 * created with a temporary password (returned once so it can be shared); the person
 * signs in with it and should change it. Then an active committee seat is granted.
 */
export async function addCommitteeMember(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = committeeSchema.parse({
      email: formData.get("email"),
      name: formData.get("name") ?? "",
      role: formData.get("role"),
    });
    const admin = getServiceClient();

    // Find an existing auth user with this email.
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users?.find((u) => u.email?.toLowerCase() === p.email.toLowerCase())?.id ?? null;

    let tempPassword: string | null = null;
    if (!userId) {
      tempPassword = "SH-" + Math.random().toString(36).slice(2, 10);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: p.email,
        password: tempPassword,
        email_confirm: true,
      });
      if (cErr || !created?.user) return { ok: false, error: "Could not create the login for that email." };
      userId = created.user.id;
    }

    // Reject a second active seat for the same user (the DB also enforces this).
    const { data: existing } = await admin
      .from("committee_members")
      .select("id")
      .eq("user_id", userId)
      .is("to_date", null)
      .maybeSingle();
    if (existing) return { ok: false, error: "That person already holds an active committee seat. Change their role instead." };

    const { error } = await admin.from("committee_members").insert({
      user_id: userId,
      role: p.role,
      from_date: new Date().toISOString().slice(0, 10),
    });
    if (error) return { ok: false, error: "Could not grant the committee seat." };

    revalidatePath("/committee/admin");
    return {
      ok: true,
      message: tempPassword
        ? `Added ${p.email} as ${p.role}. Temporary password: ${tempPassword} — share it privately; they should change it after signing in.`
        : `Added ${p.email} as ${p.role}.`,
    };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Check the details and try again." };
  }
}

export async function changeCommitteeRole(memberId: string, role: string): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsedRole = z.enum(["admin", "president", "secretary", "treasurer", "member"]).parse(role);
    const admin = getServiceClient();

    // Guard: do not let the last admin demote themselves and lock everyone out.
    const { data: member } = await admin
      .from("committee_members")
      .select("user_id, role")
      .eq("id", memberId)
      .maybeSingle();
    if (member?.role === "admin" && parsedRole !== "admin") {
      const { count } = await admin
        .from("committee_members")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .is("to_date", null);
      if ((count ?? 0) <= 1) {
        return { ok: false, error: "This is the only admin — promote someone else to admin before changing this role." };
      }
      if (member.user_id === me.userId) {
        // Allowed (another admin exists), but worth being explicit in the message.
      }
    }

    const { error } = await admin.from("committee_members").update({ role: parsedRole }).eq("id", memberId);
    if (error) return { ok: false, error: "Could not change the role." };
    revalidatePath("/committee/admin");
    return { ok: true, message: `Role changed to ${parsedRole}.` };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not change the role." };
  }
}

export async function endCommitteeTerm(memberId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = getServiceClient();
    const { data: member } = await admin
      .from("committee_members")
      .select("role")
      .eq("id", memberId)
      .maybeSingle();
    if (member?.role === "admin") {
      const { count } = await admin
        .from("committee_members")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .is("to_date", null);
      if ((count ?? 0) <= 1) {
        return { ok: false, error: "You cannot remove the only admin. Promote another admin first." };
      }
    }
    // Ending a term keeps the history (the seat is dated out, not deleted).
    const { error } = await admin
      .from("committee_members")
      .update({ to_date: new Date().toISOString().slice(0, 10) })
      .eq("id", memberId);
    if (error) return { ok: false, error: "Could not end the term." };
    revalidatePath("/committee/admin");
    return { ok: true, message: "Committee term ended. Their login remains but has no committee access." };
  } catch (e) {
    return authError(e) ?? { ok: false, error: "Could not end the term." };
  }
}
