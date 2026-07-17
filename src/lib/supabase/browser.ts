import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for the COMMITTEE login flow only. This uses the anon key
 * and is only ever used to authenticate a committee member (a real Supabase Auth
 * user). It never reads financial data — that all flows through server routes with
 * the service client. Residents never touch this; they have no Supabase identity.
 */
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  return createBrowserClient(url, anonKey);
}
