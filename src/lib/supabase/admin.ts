import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role Supabase client. This bypasses RLS and can read and write every
 * table, so it must NEVER be imported into a client component or bundled for the
 * browser. It exists only inside server components, route handlers, and server
 * actions — the access boundary is those server modules, which scope every query to
 * the caller's flat or verify the caller's committee role before touching data.
 *
 * There is deliberately no anon-key client for financial data. If you need to read
 * society data from the browser, add a server route; do not ship a Supabase key.
 */

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
        "In dev, put them in .env.local; in production, set them as Cloudflare Worker secrets.",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
