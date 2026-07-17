#!/usr/bin/env bash
#
# One-shot deploy to Cloudflare Workers.
#
# Prerequisite (once): authenticate wrangler with your Cloudflare account —
#   npx wrangler login
# This opens a browser for OAuth and cannot be done non-interactively.
#
# Then, from the project root:  bash scripts/deploy.sh
#
# What this does:
#   1. Uploads the four RUNTIME secrets from .env.local into the Worker. The first
#      `secret put` also creates the Worker, so secrets exist before any code serves.
#      These are never committed and never placed in wrangler.jsonc.
#   2. Builds and deploys. The two NEXT_PUBLIC_* values (Supabase URL + anon key)
#      are non-secret and are inlined into the bundle at build time from .env.local,
#      so they are not uploaded here.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found — it holds the secrets to upload." >&2
  exit 1
fi

# Pull one value from .env.local without sourcing the whole file.
get() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2-; }

echo "==> Uploading runtime secrets (values are not printed; first put creates the Worker)"
for name in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RESIDENT_SESSION_SECRET LOGIN_IP_SALT; do
  value="$(get "$name")"
  if [ -z "$value" ]; then
    echo "ERROR: $name is empty in .env.local" >&2
    exit 1
  fi
  printf '%s' "$value" | npx wrangler secret put "$name"
done

echo "==> Building and deploying"
npm run cf:deploy

echo
echo "==> Done. The Worker URL is printed above (…​.workers.dev)."
echo "    Add a custom domain later under the Worker → Settings → Domains & Routes."
echo "    If you rotate a secret, re-run this script or: npx wrangler secret put <NAME>"
