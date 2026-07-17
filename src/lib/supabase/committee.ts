import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "./admin";

/**
 * Committee authentication. Unlike residents, committee members are real Supabase
 * Auth users (email + password). This module resolves the current auth session and,
 * crucially, their committee role — which is read from the database, never from the
 * client, on every call.
 */

export type CommitteeRole = "president" | "secretary" | "treasurer" | "member";

export interface CommitteeIdentity {
  userId: string;
  email: string | null;
  role: CommitteeRole;
}

/** SSR Supabase client bound to the request's cookies, for the committee auth flow. */
export async function getCommitteeAuthClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // middleware refreshes the session instead. Safe to ignore.
        }
      },
    },
  });
}

/**
 * The authenticated committee member, or null. Verifies the auth session with
 * Supabase, then looks up an ACTIVE committee seat. A logged-in user who is not on
 * the committee (or whose term has ended) is not a committee member here — being
 * able to authenticate is not the same as being authorised.
 */
export async function getCommitteeIdentity(): Promise<CommitteeIdentity | null> {
  const auth = await getCommitteeAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return null;

  // Role lookup uses the service client: committee_members is RLS-locked, and the
  // role decision must not depend on a policy the user could influence.
  const admin = getServiceClient();
  const { data, error } = await admin
    .from("committee_members")
    .select("role")
    .eq("user_id", user.id)
    .is("to_date", null)
    .maybeSingle();

  if (error || !data) return null;

  return { userId: user.id, email: user.email ?? null, role: data.role as CommitteeRole };
}

/** Throws if the caller is not an active committee member. Use at the top of every
 *  committee server action and protected route. */
export async function requireCommittee(): Promise<CommitteeIdentity> {
  const identity = await getCommitteeIdentity();
  if (!identity) {
    throw new CommitteeAuthError("not authorised: active committee membership required");
  }
  return identity;
}

/** Throws unless the caller holds one of the given roles. Money-moving actions
 *  (recording payments, closing periods) are restricted to treasurer/president. */
export async function requireRole(...roles: CommitteeRole[]): Promise<CommitteeIdentity> {
  const identity = await requireCommittee();
  if (!roles.includes(identity.role)) {
    throw new CommitteeAuthError(
      `not authorised: this action requires one of [${roles.join(", ")}], you are ${identity.role}`,
    );
  }
  return identity;
}

export class CommitteeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommitteeAuthError";
  }
}
