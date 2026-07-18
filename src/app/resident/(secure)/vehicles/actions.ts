"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentSession } from "@/lib/auth/resident";
import { getServiceClient } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string; message?: string };

const vehicleSchema = z.object({
  vehicleType: z.enum(["car", "bike", "scooter", "bicycle", "other"]),
  registrationNumber: z.string().trim().min(1).max(20),
  makeModel: z.string().trim().max(80).optional(),
  color: z.string().trim().max(30).optional(),
  parkingSlot: z.string().trim().max(20).optional(),
});

/**
 * Add a vehicle to the logged-in resident's flat. The flat is taken from the signed
 * session cookie — never from the form — so a resident can only ever register a
 * vehicle against their own flat.
 */
export async function addMyVehicle(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const session = await getResidentSession();
  if (!session) return { ok: false, error: "Your session has expired. Please log in again." };

  try {
    const p = vehicleSchema.parse({
      vehicleType: formData.get("vehicleType"),
      registrationNumber: formData.get("registrationNumber"),
      makeModel: formData.get("makeModel") ?? "",
      color: formData.get("color") ?? "",
      parkingSlot: formData.get("parkingSlot") ?? "",
    });

    const admin = getServiceClient();
    const { error } = await admin.from("vehicles").insert({
      flat_id: session.flatId,
      vehicle_type: p.vehicleType,
      registration_number: p.registrationNumber,
      make_model: p.makeModel || null,
      color: p.color || null,
      parking_slot: p.parkingSlot || null,
    });
    if (error) {
      return {
        ok: false,
        error: error.code === "23505"
          ? "That registration number is already registered."
          : "Could not add the vehicle.",
      };
    }
    revalidatePath("/resident/vehicles");
    return { ok: true, message: "Vehicle added." };
  } catch {
    return { ok: false, error: "Check the details and try again." };
  }
}

/** Remove one of the logged-in resident's vehicles. Scoped to their flat, so a
 *  resident cannot delete a vehicle belonging to another flat by guessing its id. */
export async function removeMyVehicle(vehicleId: string): Promise<ActionResult> {
  const session = await getResidentSession();
  if (!session) return { ok: false, error: "Your session has expired. Please log in again." };

  try {
    const admin = getServiceClient();
    const { error } = await admin
      .from("vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("flat_id", session.flatId); // the scoping that makes this safe
    if (error) return { ok: false, error: "Could not remove the vehicle." };
    revalidatePath("/resident/vehicles");
    return { ok: true, message: "Vehicle removed." };
  } catch {
    return { ok: false, error: "Could not remove the vehicle." };
  }
}
