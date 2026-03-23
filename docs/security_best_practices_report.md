# Security Best Practices Review (commune)

Date: 2026-02-10  
Repo: `f:\commune`  
Commit: `c403b57` (main)

## Executive Summary

Top risks found in this review:

1. **Secrets handling in container builds is unsafe**: the frontend `Dockerfile` uses build args for `BACKUP_SECRET_TOKEN` and includes `VITE_AWS_SECRET_ACCESS_KEY`/`VITE_AWS_ACCESS_KEY_ID` as Vite build-time env vars (critical). (`Dockerfile:10`, `Dockerfile:18`, `Dockerfile:44-45`, `docker-compose.yml:18-19`)
2. **Frontend CSP is weak in production**: `nginx.conf` sets `script-src 'unsafe-inline' 'unsafe-eval'`, which materially reduces protection against XSS (critical). (`nginx.conf:30`)
3. **S3 upload API has missing authorization checks**: any authenticated user can request deletions for arbitrary S3 keys, and the presign endpoint allows user-controlled prefixes (high). (`server/src/routes/upload.ts:52`, `server/src/routes/upload.ts:154`, `server/src/routes/upload.ts:168`)
4. **DoS / abuse hardening gaps**: Express body parsers have no size limits (high). (`server/src/index.ts:106-107`)
5. **Dependency advisories present**: `npm audit` reports high-severity issues including a Quill XSS advisory and `fast-xml-parser` DoS (high).
6. **Source maps enabled in production builds**: Vite build ships sourcemaps by default (high). (`vite.config.ts:19`)

This repo has a good baseline in a few areas (Helmet usage, explicit CORS allowlist, Redis-backed rate limiting support, zod validation in multiple routes, DOMPurify used before `dangerouslySetInnerHTML`), but the findings above should be prioritized before treating this as production-hardened.

## Scope And Method

Stack observed:

- Frontend: React + Vite + TypeScript (SPA)
- Backend: Express + TypeScript
- Auth/DB: Supabase (client publishable key in browser, service role key in backend)
- Storage: S3 (public uploads bucket implied), S3 private backups bucket
- Edge: nginx (SPA static serving), Traefik referenced in compose
- Cache/limits: Redis-backed caching and rate limiting

Review approach:

- Static review of key entrypoints/configs: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `vite.config.ts`, server routers/services.
- Pattern scanning for high-signal security issues (XSS sinks, tokens/secrets patterns, auth/z boundaries).
- Dependency advisory triage via:
  - `npm audit --omit=dev --audit-level=high` (root)
  - `npm audit --omit=dev --audit-level=high` (`server/`)

## Findings

### Critical

**F-001: Secrets passed via Docker build args and can leak into image layers/build logs**

- Severity: Critical
- Impact: Build-time secrets (notably `BACKUP_SECRET_TOKEN`) can be exfiltrated via image history/layers or CI build logs/caches, enabling unauthorized backup triggering (and potentially other chained abuse).
- Locations:
  - `Dockerfile:10` (`ARG BACKUP_SECRET_TOKEN`)
  - `Dockerfile:18` (passes `BACKUP_SECRET_TOKEN` into `RUN ... /backup.sh`)
  - `scripts/docker-pre-build-backup.sh:27` (uses token in request header)
- Evidence:
  - `Dockerfile:10`: `ARG BACKUP_SECRET_TOKEN`
  - `Dockerfile:18`: `BACKUP_API_URL=${BACKUP_API_URL} BACKUP_SECRET_TOKEN=${BACKUP_SECRET_TOKEN} /backup.sh`
- Recommendation:
  - Do not run operational tasks (database backups) inside `docker build`.
  - If you must call an external system during build, use BuildKit secrets (`RUN --mount=type=secret,...`) so secrets are not persisted in layers.
  - Prefer moving “trigger backup” into deployment automation (CI/CD job) with a runtime secret store.

**F-002: AWS secret access key is treated as a Vite client environment variable (risk of client-side secret exposure)**

- Severity: Critical
- Impact: Any value exposed as a `VITE_*` variable is treated as browser-visible configuration (if referenced or bundled). Including an AWS secret access key here is an account-compromise footgun. Even if currently unused, it normalizes an unsafe pattern and increases the chance it gets used later.
- Locations:
  - `Dockerfile:33-45` (build args + `ENV VITE_AWS_*`)
  - `docker-compose.yml:18-19` (passes `VITE_AWS_*` build args)
  - `src/vite-env.d.ts:8-9` (declares `VITE_AWS_*` types)
  - `env examples`:
    - `.env.production.example:14-15` (includes `VITE_AWS_SECRET_ACCESS_KEY`)
- Evidence:
  - `Dockerfile:45`: `ENV VITE_AWS_SECRET_ACCESS_KEY=$VITE_AWS_SECRET_ACCESS_KEY`
  - `docker-compose.yml:19`: `- VITE_AWS_SECRET_ACCESS_KEY=${VITE_AWS_SECRET_ACCESS_KEY}`
- Recommendation:
  - Remove `VITE_AWS_ACCESS_KEY_ID` / `VITE_AWS_SECRET_ACCESS_KEY` from:
    - `Dockerfile`, `docker-compose.yml`, `.env*.example`, and `src/vite-env.d.ts`.
  - Ensure browser uploads remain based on backend-issued pre-signed URLs (already implemented: `src/services/s3.ts` uses `/api/upload/presign`).
  - For S3 public URL construction, keep only non-secret config in the client (bucket name, region), or use a CDN domain.

**F-003: Production CSP allows `unsafe-inline` and `unsafe-eval`**

- Severity: Critical
- Impact: A strict CSP is one of the primary defense-in-depth controls against XSS. With `script-src 'unsafe-inline' 'unsafe-eval'`, most XSS payloads become much easier to execute and CSP provides little protection.
- Location:
  - `nginx.conf:30`
- Evidence:
  - `nginx.conf:30`: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
  - `index.html:38` includes an inline `<script>` (theme flash prevention), which forces `unsafe-inline` unless replaced by nonced/hashed scripts or moved.
- Recommendation:
  - Remove `'unsafe-eval'` and `'unsafe-inline'` from `script-src` for production.
  - Eliminate inline scripts in `index.html` or use CSP nonces/hashes.
  - If a dependency forces `unsafe-eval`, isolate/replace it; treat “needs unsafe-eval” as a high-risk constraint requiring explicit documentation and compensating controls.

### High

**F-004: Upload delete endpoint allows arbitrary object deletion by any authenticated user**

- Severity: High
- Impact: Any authenticated user can delete any object in the uploads bucket by providing its key, enabling destructive abuse and cross-tenant data loss.
- Location:
  - `server/src/routes/upload.ts:154` (delete route)
  - `server/src/routes/upload.ts:168` (uses request-provided key directly)
- Evidence:
  - `server/src/routes/upload.ts:160`: parses `{ key }` from request body
  - `server/src/routes/upload.ts:168`: `Key: parsed.data.key`
- Recommendation:
  - Enforce ownership/authorization on deletes:
    - Namespace keys by user ID (`uploads/{userId}/...`) and require the key to start with that prefix, and
    - Maintain a DB table mapping `asset -> owner` and authorize deletes based on that record.
  - Consider restricting deletes to “assets created by this app” only, and never allow deleting outside that namespace.

**F-005: Presign endpoint allows user-controlled prefixes (`folder`)**

- Severity: High
- Impact: Users can choose arbitrary S3 key prefixes (within string length limits). This can allow overwriting or planting files in unintended namespaces, and makes later authorization checks harder.
- Location:
  - `server/src/routes/upload.ts:52` (`folder` is user-controlled)
  - `server/src/routes/upload.ts:127` (folder used to build key)
- Evidence:
  - `server/src/routes/upload.ts:52`: `folder: z.string().min(1).max(100).default('uploads')`
- Recommendation:
  - Replace free-form `folder` with an allowlist enum (e.g., `images|avatars|videos|documents`).
  - Always prefix with the authenticated user id (or a server-assigned tenant id).

**F-006: Express body parsers have no explicit limits**

- Severity: High
- Impact: Large request bodies or parameter bombs can increase memory/CPU use and trigger outages (DoS).
- Location:
  - `server/src/index.ts:106-107`
- Evidence:
  - `server/src/index.ts:106`: `express.urlencoded({ extended: true })`
  - `server/src/index.ts:107`: `express.json()`
- Recommendation:
  - Add explicit limits and parameter caps, for example:
    - `express.json({ limit: '1mb' })`
    - `express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 1000 })`
  - Consider separate limits for webhook routes if they legitimately need larger payloads.

**F-007: High-severity dependency advisories (`npm audit`)**

- Severity: High
- Impact: Known vulnerable transitive dependencies may enable XSS or DoS depending on exploitability in your usage.
- Evidence (from `npm audit --omit=dev --audit-level=high`):
  - Root:
    - `quill =2.0.3` advisory: “vulnerable to XSS via HTML export feature”
    - `fast-xml-parser` advisory: RangeError DoS
  - Server:
    - `fast-xml-parser` advisory via `@aws-sdk/xml-builder`
- Recommendation:
  - Triage and upgrade with focus on high-impact packages:
    - Upgrade the dependency chain that brings in `quill` (likely via `react-quill-new`) and validate editor HTML sanitization is still correct.
    - Upgrade AWS SDK packages to versions that pull a fixed `@aws-sdk/xml-builder` / `fast-xml-parser`.
  - Add a CI check (or scheduled job) to surface new advisories, but avoid auto-upgrading without testing.

**F-008: Production sourcemaps enabled**

- Severity: High
- Impact: Publicly served sourcemaps materially increase attacker understanding of application internals (routes, feature flags, error handling paths), which can reduce time-to-exploit for multiple classes of issues.
- Location:
  - `vite.config.ts:19`
- Evidence:
  - `vite.config.ts:19`: `sourcemap: true`
- Recommendation:
  - Disable sourcemaps in production builds, or publish them only to a controlled error-monitoring system.
  - Make sourcemaps conditional (e.g., `sourcemap: process.env.SOURCEMAP === 'true'`).

### Medium

**F-009: Backup/webhook shared secrets accepted via URL query parameters**

- Severity: Medium (High for operational sensitivity, depending on logging/edge behavior)
- Impact: Tokens in URLs are commonly leaked via reverse proxy access logs, browser history, Referer headers, and monitoring tools.
- Locations:
  - `server/src/routes/backup.ts:55` (`req.query.token`)
  - `server/src/routes/gumroad-webhook.ts:820` (`req.query.token`)
  - `server/.env.example:19` documents using `?token=...`
- Evidence:
  - `server/src/routes/backup.ts:55`: `req.headers['x-backup-token'] || req.query.token`
  - `server/src/routes/gumroad-webhook.ts:820`: `Array.isArray(req.query.token) ? ... : req.query.token`
- Recommendation:
  - For backup automation: accept the token only via a header (and consider IP allowlisting at the edge).
  - For Gumroad: prefer Gumroad’s official signature mechanism (if available) and validate via a shared secret; avoid query-string secrets.
  - Use `crypto.timingSafeEqual` for comparing fixed secrets (defense-in-depth).

**F-010: Supabase session persisted in browser storage**

- Severity: Medium
- Impact: `persistSession: true` typically stores tokens in Web Storage; any XSS can exfiltrate long-lived tokens. This makes frontend XSS consequences significantly worse.
- Location:
  - `src/services/supabase.ts:18-20`
- Evidence:
  - `src/services/supabase.ts:19`: `persistSession: true`
- Recommendation:
  - If feasible, move toward server-managed session cookies (HTTPOnly) for the web app, or reduce token lifetime/scope and harden XSS defenses (strict CSP, Trusted Types).
  - At minimum, treat CSP hardening (F-003) as required if you keep storage-persisted tokens.

**F-011: `window.open(..., '_blank')` without noopener**

- Severity: Medium (often Low, but depends on what URLs can be opened)
- Impact: Tabnabbing / opener control risk if the opened page is attacker-controlled.
- Location:
  - `src/services/backup.ts:100`
- Evidence:
  - `src/services/backup.ts:100`: `window.open(downloadUrl, '_blank');`
- Recommendation:
  - Use `window.open(downloadUrl, '_blank', 'noopener,noreferrer')` (and/or set `opener` to `null`).

**F-012: Non-cryptographic randomness used for S3 object keys**

- Severity: Low to Medium
- Impact: Predictable IDs can make guessing/enumeration easier; also reduces robustness if keys are treated as “unguessable”.
- Location:
  - `server/src/routes/upload.ts:77`
- Evidence:
  - `server/src/routes/upload.ts:77`: `Math.random()...`
- Recommendation:
  - Use `crypto.randomUUID()` or `crypto.randomBytes(...)` for key components.

**F-013: Manual use of `x-forwarded-for` in webhook route**

- Severity: Low to Medium
- Impact: IP address in logs and DB can be spoofed unless you exclusively trust a proxy chain that overwrites the header.
- Location:
  - `server/src/routes/gumroad-webhook.ts:814`
- Evidence:
  - `server/src/routes/gumroad-webhook.ts:814`: `req.headers['x-forwarded-for'] as string || req.ip`
- Recommendation:
  - Prefer `req.ip` and ensure `trust proxy` is correctly set to match the real proxy chain.
  - If you must read `x-forwarded-for`, do so only when behind a trusted proxy and parse it safely.

### Low / Hygiene

**F-014: Express fingerprinting header not explicitly disabled**

- Severity: Low
- Impact: `X-Powered-By: Express` increases fingerprinting (defense-in-depth).
- Location:
  - `server/src/index.ts` (no `app.disable('x-powered-by')` observed)
- Recommendation:
  - Add `app.disable('x-powered-by')` near app initialization.

**F-015: Environment example files encourage unsafe client-side secrets**

- Severity: Low (but contributes directly to Critical misconfiguration patterns)
- Locations:
  - `.env.production.example:14-15` (Vite AWS access/secret keys)
  - `server/.env.example:43-44` (server-side AWS creds are expected, which is fine)
- Recommendation:
  - Ensure example env files clearly separate:
    - “public browser config” (safe to expose) vs
    - “server-only secrets” (never in Vite vars).

## Notes / Positives Observed

- DOM XSS escape hatches are generally paired with DOMPurify sanitization:
  - `src/components/feed/PostCard.tsx:335`
  - `src/pages/ShowcaseDetail.tsx:357`
  - `src/components/groups/MarkdownPreviewModal.tsx:291`
- Backend uses Helmet and CORS allowlist:
  - `server/src/index.ts:37-47`
- Multiple routes validate request bodies with zod (good boundary control).

## Recommended Next Steps (Suggested Order)

1. Fix container/build secret handling (F-001, F-002) and remove client-side AWS secret variables everywhere.
2. Tighten production CSP and remove inline/eval allowances (F-003). Make this compatible with the app (move inline scripts out, iterate in report-only if needed).
3. Fix S3 upload authorization boundaries (F-004, F-005) before relying on uploads at scale.
4. Add request size limits (F-006) and review per-route limit needs.
5. Triage `npm audit` high issues and plan upgrades (F-007).
6. Disable production sourcemaps or publish them privately (F-008).
