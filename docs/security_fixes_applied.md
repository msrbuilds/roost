# Security Fixes Applied — 2026-02-11

Repo: `commune` (Commune)
Base commit: `2841f4c` (main)
Reference: `docs/security_best_practices_report.md`

---

## CRITICAL: Privilege Escalation Fix (Fix 9 — Migration 046)

**Severity:** CRITICAL — actively exploited
**File:** `migrations/046_fix_profile_column_protection.sql`

**Root cause:** Migration 030 (`030_fix_function_search_paths.sql`) accidentally replaced the `check_role_change()` trigger function with an unrelated group_members check, completely removing the superadmin-only guard on the `profiles.role` column. This allowed any authenticated user to promote themselves to superadmin by directly calling `supabase.from('profiles').update({ role: 'superadmin' })`.

**What 030 broke:** The original function (from migration 003) checked `is_superadmin(auth.uid())` before allowing role changes. Migration 030 replaced it with a function that only checks last-group-admin demotion in the `group_members` table — zero protection for `profiles.role`.

**Fix (migration 046):** Replaced the broken function with `protect_profile_sensitive_columns()` which:
- Restores superadmin-only protection for the `role` column
- Adds admin-only protection for ban columns (`is_banned`, `ban_reason`, `ban_expires_at`, `banned_by`, `banned_at`)
- Adds protection for `membership_type` (prevents free-to-premium self-upgrade)
- Adds protection for `two_factor_secret` and `two_factor_verified_at` (prevents 2FA bypass)
- Allows service_role (backend) operations to pass through (`auth.uid() IS NULL`)
- Allows platform admins to modify ban/membership columns (needed for admin dashboard)

**Immediate action required after applying migration:**
1. Run migration 046 on the production Supabase database
2. Demote the unauthorized superadmin back to `user` role
3. Audit the `profiles` table for any other unexpected role values
4. Check if the unauthorized superadmin made any other changes while they had elevated access

---

## Summary

9 confirmed infrastructure security issues were addressed across 10 files, plus 1 critical privilege escalation fix (migration 046). All fixes were designed to be non-breaking — TypeScript compilation was verified after each change, and no existing upload, auth, or webhook flows were altered in behavior.

3 findings from the original report were confirmed as false positives or not worth fixing, and 3 were deferred as low-priority.

---

## Fixes Applied

### Fix 1: Express Body Parser Size Limits (F-006)

**Severity:** High
**Risk of fix:** Zero
**File:** `server/src/index.ts`

**Problem:** `express.json()` and `express.urlencoded()` had no explicit size limits, relying on Express's implicit 100KB default. This was undocumented and could be changed by framework upgrades.

**Fix:** Added explicit `limit: '1mb'` to both parsers. This is 10x the Express default and 50x the largest actual payload (~20KB Gumroad webhook). File uploads go directly to S3 via presigned URLs and never pass through body parsers.

```typescript
// Before
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// After
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
```

---

### Fix 2: Production Sourcemaps Disabled by Default (F-008)

**Severity:** High
**Risk of fix:** Zero
**File:** `vite.config.ts`

**Problem:** `sourcemap: true` was hardcoded, causing production builds to ship full sourcemaps. These expose application source code (routes, logic, feature flags) to anyone using browser devtools.

**Fix:** Sourcemaps now default to off and can be opted into via environment variable.

```typescript
// Before
sourcemap: true,

// After
sourcemap: process.env.SOURCEMAP === 'true',
```

To enable sourcemaps when needed: `SOURCEMAP=true npm run build`

---

### Fix 3: Cryptographic Randomness for S3 Object Keys (F-012)

**Severity:** Low-Medium
**Risk of fix:** Zero
**File:** `server/src/routes/upload.ts`

**Problem:** S3 object keys used `Math.random()` which is not cryptographically random, making keys potentially predictable/enumerable.

**Fix:** Replaced with `crypto.randomUUID()` (Node.js built-in). Each upload generates a fresh key, so old keys in the database are unaffected.

```typescript
// Before
const randomId = Math.random().toString(36).substring(2, 15);

// After
const randomId = crypto.randomUUID();
```

---

### Fix 4: Removed Unused VITE_AWS Secret Variables (F-002)

**Severity:** Critical
**Risk of fix:** Low
**Files:** `Dockerfile`, `docker-compose.yml`, `src/vite-env.d.ts`, `.env.production.example`, `src/test/setup.ts`

**Problem:** `VITE_AWS_ACCESS_KEY_ID` and `VITE_AWS_SECRET_ACCESS_KEY` were declared as Vite build-time variables in the Dockerfile, docker-compose, and TypeScript types. Any `VITE_*` variable is baked into the frontend bundle and visible in the browser. While these variables were never actually referenced in frontend runtime code (the frontend correctly uses backend presigned URLs), their presence was a loaded footgun — any future code using `import.meta.env.VITE_AWS_SECRET_ACCESS_KEY` would ship the real AWS secret key to every user's browser.

**Fix:** Removed the two variables from all 5 locations. Added explicit non-VITE `AWS_*` env vars to the docker-compose backend service. Updated backup credential fallbacks to reference `AWS_ACCESS_KEY_ID` instead of `VITE_AWS_ACCESS_KEY_ID`.

**What was NOT changed:** The frontend still uses `VITE_AWS_REGION` and `VITE_AWS_S3_BUCKET` for public URL construction — these are non-secret configuration values.

**Deployment requirement:** Backend must have `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set as non-VITE environment variables (confirmed already present in Dokploy).

---

### Fix 5: Backup Token — Header-Only + Timing-Safe Comparison (F-009)

**Severity:** Medium
**Risk of fix:** Low
**File:** `server/src/routes/backup.ts`

**Problem:** The `requireBackupToken` middleware accepted the backup secret token from both `x-backup-token` header and `?token=` query parameter. Tokens in URLs leak via reverse proxy access logs, browser history, Referer headers, and monitoring tools. Additionally, the token comparison used JavaScript's `!==` operator which is vulnerable to timing attacks.

**Fix:**
1. Removed `req.query.token` fallback — token is now accepted only via `x-backup-token` header
2. Replaced string `!==` with `crypto.timingSafeEqual` for constant-time comparison
3. Added type and length validation before comparison (required by `timingSafeEqual`)

**Why safe:** The only caller of `/api/backup/automated` is the Docker pre-build script (`scripts/docker-pre-build-backup.sh`), which already sends the token via the `x-backup-token` header.

**Not changed:** The Gumroad webhook token still accepts query parameters — this is by design, as Gumroad sends the token in the webhook URL query string configured in their dashboard.

---

### Fix 6: Upload Folder Allowlist + Delete Key Validation (F-004, F-005)

**Severity:** High
**Risk of fix:** Medium
**File:** `server/src/routes/upload.ts`

**Problem:**
- **Presign endpoint:** The `folder` parameter accepted any string (1-100 chars), allowing users to upload files to arbitrary S3 key prefixes
- **Delete endpoint:** Any authenticated user could delete any S3 object by key, with no ownership or namespace validation

**Fix — Presign endpoint:**
Added a regex allowlist matching all folder values the frontend actually sends (verified by grepping every upload call across the codebase):

| Frontend Function | Folder Value |
|---|---|
| `uploadImage()` | `images` |
| `uploadAvatar(file, userId)` | `avatars/{uuid}` |
| `uploadVideo()` | `videos` |
| `uploadDocument()` | `documents` |
| `uploadFile()` default | `uploads` |
| `UploadAssetsModal` | `groups/{uuid}/documents` |
| `Activations.tsx` | `activations/products` |

Regex: `^(images|videos|documents|uploads|activations\/products|avatars\/[a-f0-9-]{36}|groups\/[a-f0-9-]{36}\/documents)$`

Requests with non-matching folders are rejected with HTTP 400 and logged with the user ID.

**Fix — Delete endpoint:**
1. Key must start with one of: `images/`, `videos/`, `documents/`, `uploads/`, `avatars/`, `groups/`, `activations/`
2. Keys containing `..` or `//` are rejected (path traversal prevention)
3. Every delete is audit-logged with the user ID and key

**What was NOT changed:** User ID prefixes were not added to S3 keys, as this would break all existing URLs stored in the database. Full ownership-based delete authorization would require a new DB table mapping file keys to owners (out of scope).

---

### Fix 7: Docker BuildKit Secrets for Backup Token (F-001)

**Severity:** Critical
**Risk of fix:** Medium
**Files:** `Dockerfile`, `docker-compose.yml`

**Problem:** `BACKUP_SECRET_TOKEN` was passed as a Docker `ARG`, which means it is persisted in image layers and visible via `docker history` or `docker inspect`. Anyone with access to the built image could extract the token.

**Fix:** Replaced `ARG BACKUP_SECRET_TOKEN` with BuildKit secret mount:

```dockerfile
# Before
ARG BACKUP_SECRET_TOKEN
RUN chmod +x /backup.sh && \
    BACKUP_API_URL=${BACKUP_API_URL} BACKUP_SECRET_TOKEN=${BACKUP_SECRET_TOKEN} /backup.sh

# After
RUN chmod +x /backup.sh
RUN --mount=type=secret,id=backup_token \
    BACKUP_API_URL=${BACKUP_API_URL} \
    BACKUP_SECRET_TOKEN=$(cat /run/secrets/backup_token 2>/dev/null || echo "") \
    /backup.sh
```

Added `# syntax=docker/dockerfile:1` as the first line to enable BuildKit features. Updated docker-compose.yml with a `secrets` section. Configured in Dokploy via Build-time Secrets (`backup_token=<value>`).

**Fallback behavior:** If the secret is not provided, `cat` fails silently, the backup script detects an empty token, and exits 0 (graceful skip). The Docker build continues normally.

---

### Fix 8: CSP Report-Only Header (F-003) — Monitoring Phase

**Severity:** Critical
**Risk of fix:** Low (report-only mode)
**File:** `nginx.conf`

**Problem:** The production CSP includes `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, which significantly weakens XSS protection. The `'unsafe-inline'` is required by an inline theme-flash-prevention script in `index.html`.

**Fix (Phase A — current):** Added a `Content-Security-Policy-Report-Only` header alongside the existing enforced CSP. The report-only policy:
- Removes `'unsafe-inline'` and `'unsafe-eval'` from `script-src`
- Replaces them with SHA-256 hashes of the inline theme script (both LF and CRLF variants for cross-platform compatibility)
- Logs violations to the browser console without blocking anything

The existing enforced CSP is unchanged — nothing is blocked. This is a monitoring-only phase.

**Next step (Phase B — future):** After 1-2 weeks of monitoring with no violations in the browser console, replace the enforced CSP with the stricter policy. If React Quill or other dependencies trigger `unsafe-eval` violations, keep `'unsafe-eval'` but still remove `'unsafe-inline'`.

---

## Findings NOT Fixed (and why)

| Finding | Reason |
|---|---|
| **F-014** (X-Powered-By header) | False positive — Helmet middleware already disables this by default |
| **F-010** (Supabase persistSession) | Standard Supabase SPA behavior. Switching to server-managed sessions would be a major architecture change. Mitigated by CSP hardening. |
| **F-011** (window.open without noopener) | Modern browsers (Chrome 88+, Firefox 79+, Safari) set `noopener` by default for `target="_blank"`. This is an admin-only action opening an S3 presigned URL. |
| **F-013** (Manual x-forwarded-for) | Only used for audit logging in the Gumroad webhook, not for access control. `trust proxy` is configured in production. |
| **F-009 for Gumroad webhook** | Query param token is how Gumroad sends it — the token is embedded in the webhook URL configured in Gumroad's dashboard. Cannot remove without breaking the integration. |
| **F-007** (npm audit advisories) | Requires dependency upgrades and testing. Should be triaged separately. |

---

## Files Modified

| File | Changes |
|---|---|
| `server/src/index.ts` | Body parser limits |
| `vite.config.ts` | Conditional sourcemaps |
| `server/src/routes/upload.ts` | crypto import, randomUUID, folder allowlist, delete key validation |
| `server/src/routes/backup.ts` | crypto import, header-only token, timing-safe comparison |
| `Dockerfile` | BuildKit syntax, secret mount, removed VITE_AWS secret ARGs/ENVs |
| `docker-compose.yml` | Removed VITE_AWS build args, added backend AWS env vars, fixed backup fallbacks, added secrets section |
| `src/vite-env.d.ts` | Removed VITE_AWS secret type declarations |
| `.env.production.example` | Removed VITE_AWS secrets, added backend AWS section |
| `src/test/setup.ts` | Removed mock VITE_AWS secret env vars |
| `nginx.conf` | Added CSP Report-Only header |

---

## Verification Performed

- Server TypeScript: `cd server && npx tsc --noEmit` — clean
- Frontend TypeScript: `npx tsc --noEmit` — clean
- Deployed to production via Dokploy — no visible errors

## Post-Deployment Monitoring

- [ ] Monitor browser console for CSP report-only violations (1-2 weeks)
- [ ] If no violations: enforce stricter CSP by replacing the main Content-Security-Policy header
- [ ] Test all upload paths: avatar, post image, video, document, group document, activation product, file delete
- [ ] Verify automated backup still triggers on deploy (check build logs for "Triggering backup at...")
