import { cookies, headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  RESIDENT_COOKIE_NAME,
  verifyResidentSession,
  type ResidentSession,
} from "./resident-session";

/**
 * Server-side resident identity. Reads the signed cookie and returns the flat the
 * resident is scoped to — or null. Every resident-facing server component and route
 * starts here and scopes its queries to `session.flatId`. The flat id in the cookie
 * is the entire access boundary for residents, which is why the cookie is signed and
 * why nothing downstream ever takes a flat id from the query string or request body.
 */
export async function getResidentSession(): Promise<ResidentSession | null> {
  const secret = process.env.RESIDENT_SESSION_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(RESIDENT_COOKIE_NAME)?.value;
  return verifyResidentSession(token, secret);
}

/** Hash the client IP with a server salt for rate-limiting, so we throttle abusers
 *  without storing raw IP addresses. */
export async function hashClientIp(): Promise<string> {
  const salt = process.env.LOGIN_IP_SALT ?? "";
  const hdrs = await headers();
  // Cloudflare sets cf-connecting-ip; fall back to x-forwarded-for's first hop.
  const ip =
    hdrs.get("cf-connecting-ip") ??
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface FlatLoginResult {
  ok: boolean;
  flatId?: string;
  flatNumber?: string;
  reason?: "not_found" | "phone_mismatch" | "throttled" | "no_resident";
}

/**
 * Verify a resident login attempt: does the given phone match the primary resident
 * currently registered for this block+flat? Records the attempt for rate limiting
 * either way. Does NOT set the cookie — the route handler does that on success, so
 * this stays a pure check.
 */
export async function verifyFlatLogin(
  block: string,
  flatNumber: string,
  phone: string,
): Promise<FlatLoginResult> {
  const admin = getServiceClient();
  const ipHash = await hashClientIp();

  const { data: throttled } = await admin.rpc("resident_login_is_throttled", {
    p_ip_hash: ipHash,
    p_flat_number: flatNumber,
  });
  if (throttled) {
    return { ok: false, reason: "throttled" };
  }

  const record = async (succeeded: boolean) => {
    await admin.from("resident_login_attempts").insert({
      flat_number: flatNumber,
      ip_hash: ipHash,
      succeeded,
    });
  };

  const { data: flat } = await admin
    .from("flats")
    .select("id, number, block_id, blocks!inner(code)")
    .eq("number", flatNumber)
    .eq("is_active", true)
    .maybeSingle();

  // Guard against a flat number from one block being paired with another block.
  const flatBlock = (flat as { blocks?: { code?: string } } | null)?.blocks?.code;
  if (!flat || flatBlock !== block) {
    await record(false);
    return { ok: false, reason: "not_found" };
  }

  // Any registered active resident's phone (owner or tenant) is a valid credential.
  const { data: activeResidents } = await admin
    .from("flat_residents")
    .select("residents!inner(phone)")
    .eq("flat_id", flat.id)
    .is("to_date", null);

  const registeredPhones = (activeResidents ?? [])
    .map((r) => (r as { residents?: { phone?: string } }).residents?.phone)
    .filter((p): p is string => Boolean(p));

  if (registeredPhones.length === 0) {
    await record(false);
    return { ok: false, reason: "no_resident" };
  }

  const normalised = phone.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");
  if (!registeredPhones.includes(normalised)) {
    await record(false);
    return { ok: false, reason: "phone_mismatch" };
  }

  await record(true);
  return { ok: true, flatId: flat.id, flatNumber: flat.number };
}
