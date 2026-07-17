# Sapthami Heights — Maintenance & Transparency

A ledger and transparency app for a 32-flat society (Block A: 15, Block B: 16 +
penthouse). **No money moves through it.** The committee records what happened
offline — dues, payments, expenses, water bought and metered — and every resident can
see the resulting numbers, including exactly how their water charge was derived.

## What it does

- **Double-entry accounting** enforced in the database: every entry balances or the
  transaction is rejected; posted entries are immutable (corrections are reversals).
- **Blended water billing** from two sources (Manjeera + tankers) with exact-integer,
  largest-remainder allocation so 32 flat charges sum to the bill to the paisa.
- **Resident access** with no password — block + flat + registered phone.
- **Committee back-office** — meter readings, water bills, atomic monthly close,
  payments, expenses, defaulters, trial balance and reconciliation.
- **Issues** with cost estimates and estimate-vs-actual tracking.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind · deployed to
Cloudflare Workers via OpenNext.

## Local setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Copy env** and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   From Supabase → Project Settings → API, set `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Generate the two secrets:
   ```bash
   openssl rand -base64 48   # RESIDENT_SESSION_SECRET
   openssl rand -base64 48   # LOGIN_IP_SALT
   ```

3. **Push the schema** (link once, then push migrations):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This creates every table, the ledger invariants, and seeds the 32 flats and chart
   of accounts.

4. **Create a committee login.** In Supabase → Authentication → Users, add a user
   (email + password). Then in the SQL editor, make them a committee member:
   ```sql
   insert into committee_members (user_id, role, from_date)
   values ('<the-auth-user-id>', 'treasurer', current_date);
   ```

5. **Run:**
   ```bash
   npm run dev
   ```
   Committee signs in at `/committee`; residents enter at `/resident`. Residents can
   only log in once the committee sets their flat's primary resident (with phone) on
   the Admin page.

## Testing

```bash
npm test          # water engine, money, session crypto (fuzz + edge cases)
```

## Deploy to Cloudflare

```bash
npm run cf:deploy
```
Set production secrets (not committed) with:
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESIDENT_SESSION_SECRET
npx wrangler secret put LOGIN_IP_SALT
```
Public vars (`SUPABASE_URL`, `NEXT_PUBLIC_*`) go in `wrangler.jsonc` or the dashboard.

## A note on the resident gate

Block + flat + phone is a **soft gate**: it stops casual snooping on a neighbour's
dues, not a determined person who knows the number. It's rate-limited by IP and flat.
This is a deliberate trade for zero-friction access; society-wide figures are open to
all by design.
