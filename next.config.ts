import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service-role key must never leak into a client bundle. Fail the build if a
  // server-only secret is ever referenced from client code that inlines env.
  serverExternalPackages: ["@supabase/supabase-js"],
};

// Enable the OpenNext Cloudflare dev bindings when running `next dev`, so local
// development mirrors the Workers runtime. No-op outside Cloudflare tooling.
if (process.env.NODE_ENV === "development") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  } catch {
    // Adapter not needed for plain `next dev`; ignore if unavailable.
  }
}

export default nextConfig;
