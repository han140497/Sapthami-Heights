/**
 * Resident session cookie.
 *
 * Residents have no Supabase identity. After a resident proves they know a flat's
 * registered phone number, the server issues a signed cookie carrying only the
 * flat_id. This module signs and verifies that cookie.
 *
 * The signature is HMAC-SHA256 via Web Crypto — not Node's crypto — because this
 * code runs on Cloudflare Workers, which has no Node crypto. The secret
 * (RESIDENT_SESSION_SECRET) is server-only and never reaches the browser.
 *
 * What this cookie is and is not: it is proof that, at some point, someone knew a
 * flat's phone number. It is a soft gate against a neighbour casually snooping, not
 * authentication. The threat model and its limits are documented in the plan.
 */

const ENCODER = new TextEncoder();
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface ResidentSession {
  flatId: string;
  flatNumber: string;
  /** Unix seconds. */
  issuedAt: number;
  expiresAt: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time comparison so signature checks don't leak via timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signResidentSession(
  flatId: string,
  flatNumber: string,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error("RESIDENT_SESSION_SECRET is not set");

  const now = Math.floor(Date.now() / 1000);
  const payload: ResidentSession = {
    flatId,
    flatNumber,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };

  const body = base64UrlEncode(ENCODER.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, ENCODER.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Returns the session if the signature is valid and unexpired, else null. */
export async function verifyResidentSession(
  token: string | undefined,
  secret: string,
): Promise<ResidentSession | null> {
  if (!token || !secret) return null;

  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let expectedSig: Uint8Array;
  try {
    const key = await importKey(secret);
    expectedSig = new Uint8Array(await crypto.subtle.sign("HMAC", key, ENCODER.encode(body)));
  } catch {
    return null;
  }

  let providedBytes: Uint8Array;
  try {
    providedBytes = base64UrlDecode(providedSig);
  } catch {
    return null;
  }

  if (!timingSafeEqual(expectedSig, providedBytes)) return null;

  let session: ResidentSession;
  try {
    session = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
  } catch {
    return null;
  }

  if (typeof session.expiresAt !== "number" || session.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }
  if (!session.flatId) return null;

  return session;
}

export const RESIDENT_COOKIE_NAME = "sh_resident";
export const RESIDENT_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
