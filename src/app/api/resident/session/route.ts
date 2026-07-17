import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyFlatLogin } from "@/lib/auth/resident";
import {
  RESIDENT_COOKIE_NAME,
  RESIDENT_COOKIE_MAX_AGE,
  signResidentSession,
} from "@/lib/auth/resident-session";

const bodySchema = z.object({
  block: z.string().trim().min(1).max(2),
  flatNumber: z.string().trim().min(2).max(12),
  phone: z.string().trim().min(10).max(15),
});

/**
 * Resident login. Verifies block + flat + phone against the registered primary
 * resident, and on success sets the signed session cookie. Deliberately returns the
 * same generic failure for every wrong-credential case so the endpoint cannot be
 * used to enumerate which flats exist or which phone numbers are registered.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }

  const result = await verifyFlatLogin(parsed.block, parsed.flatNumber, parsed.phone);

  if (result.reason === "throttled") {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  if (!result.ok || !result.flatId || !result.flatNumber) {
    // One message for every failure mode — no oracle for attackers.
    return NextResponse.json(
      { ok: false, error: "Those details don't match our records for this flat." },
      { status: 401 },
    );
  }

  const secret = process.env.RESIDENT_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }

  const token = await signResidentSession(result.flatId, result.flatNumber, secret);
  const response = NextResponse.json({ ok: true, flatNumber: result.flatNumber });
  response.cookies.set(RESIDENT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESIDENT_COOKIE_MAX_AGE,
  });
  return response;
}

/** Log out — clear the cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RESIDENT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
