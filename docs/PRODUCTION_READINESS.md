# Pilot Ledger — production readiness

## What is ready

- Cloudflare Worker deploy with custom domain `pilot-ledger.download`
- D1 authentication session storage and email OTP
- OpenAI receipt OCR secret stored in Cloudflare
- PWA manifest and service worker
- GitHub Actions workflow that builds, tests and deploys `main`
- Supabase schema with per-user RLS for profiles, transactions and goals

## Supabase setup

1. Create a Supabase project in the region closest to Moldova.
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
3. Copy the project URL and the public `anon` key into local `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Configure the same values in the deployment environment when the client migration is enabled.
5. Never place the Supabase `service_role` key in the browser or in GitHub logs.

## GitHub deploy secrets

In repository **Settings → Secrets and variables → Actions**, add:

- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

Every push to `main` then runs `npm ci`, the production build, all tests, and `wrangler deploy`.

## Migration plan

The current application still keeps the transaction and goal UI state in localStorage. The safe migration sequence is:

1. Add Supabase Auth and map each authenticated user to `auth.users.id`.
2. Add a repository layer that reads Supabase first and uses localStorage only for offline queueing.
3. Migrate existing local records once per browser, with an idempotency key.
4. Enable offline writes and retry after reconnect.
5. Remove local-only persistence only after the sync path has been tested with multiple accounts.
