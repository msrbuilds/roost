# Roost — Repository Guide

Roost is a self-hosted community platform built with React 19, Vite, TypeScript, Tailwind CSS, Express, and Supabase. It supports Supabase Cloud and the bundled self-hosted Supabase stack. Authentication and MFA use Supabase Auth; authorization is enforced by PostgreSQL RLS and hardened RPC boundaries.

## Architecture

- `src/` — React application, Supabase-backed services, routes, and components.
- `server/src/` — trusted Express API for uploads/download authorization, account operations, email, Stripe, backups, and administrative integrations.
- `schema.sql` — authoritative clean-install PostgreSQL schema, functions, triggers, grants, and RLS policies.
- `docker-compose.yml` — general Docker/VPS deployment.
- `docker-compose.dokploy.yml` and `dokploy-template/` — bundled self-hosted Supabase/MinIO deployment.
- `guides/` — deployment and provider documentation.

Uploaded objects are private by default. Browser clients upload through the backend and store an opaque `private:<storage-key>` marker for protected media. Never expose S3/MinIO credentials or construct direct private-object URLs in the frontend.

## Commands

```bash
npm run check            # frontend typecheck, lint, and unit tests
npm run build            # required checks plus production frontend build
npm run build:server     # compile the Express server
npm run build:all        # build frontend and server
npm run dev:all          # run frontend and backend locally
npm run test:e2e         # Playwright browser tests
bash install.sh          # interactive environment/deployment setup
```

## Configuration

Frontend variables are documented in `.env.example`; backend variables are in `server/.env.example`.

- `VITE_DB_PROVIDER` is `supabase-cloud` or `supabase-selfhosted`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are safe browser credentials.
- `SUPABASE_SECRET_KEY`, S3 credentials, SMTP credentials, Stripe secrets, and backup tokens are server-only.
- Runtime feature access is stored in `site_settings` and must be enforced in both navigation and database policies.

## Security invariants

- Never trust client-supplied user, administrator, role, membership, or ownership identifiers; bind them to `auth.uid()` or the verified backend token.
- Keep privileged RPCs `SECURITY DEFINER` only when necessary, use a fixed `search_path`, and explicitly grant execution to the narrowest role.
- Profile creation/deletion is owned by the Supabase Auth lifecycle. Users must not delete and recreate profile rows.
- MFA secrets stay in Supabase Auth. The profile stores only the synchronized enrollment flag, and enrolled accounts require `aal2`.
- Private group, message, activation, and classroom media must be authorized before the backend returns bytes.
- Feature flags are authorization decisions, not merely UI hints.
- Preserve the card design rule: use borders for elevation; do not add `shadow-*` card classes.

## Database changes

Update `schema.sql` for clean installs and validate it against a fresh PostgreSQL database with `ON_ERROR_STOP=1`. Regenerate or update `src/types/database.ts` whenever the public schema changes. Existing production databases require a reviewed migration before applying schema changes.
