# Security Review Report

Scope: Server API routes, admin routes, rate limiting, and webhook security.

## Findings (ordered by severity)

### Critical
- Webhook authenticity is not verified. Anyone can POST to `/api/webhooks/gumroad` and trigger account creation, group membership changes, and emails. There is no signature/secret validation or seller/product allow-list check before processing.
  - Locations: `server/src/routes/gumroad-webhook.ts:448`, `server/src/routes/gumroad-webhook.ts:122`
  - Impact: forged webhooks can create users, grant access, or spam emails.
  - Fix: verify Gumroad webhook signature/secret using the raw body, and reject if `seller_id` and `product_id` don’t match expected values.

### High
- `trust proxy` is enabled unconditionally. This allows client-supplied `X-Forwarded-For` to spoof IPs when not behind a trusted proxy, undermining rate limiting and IP logging.
  - Locations: `server/src/index.ts:13`, `server/src/index.ts:30`, `server/src/routes/gumroad-webhook.ts:449`
  - Impact: attackers can bypass rate limits and poison logs.
  - Fix: only enable `trust proxy` in environments actually behind a trusted proxy, and set the exact proxy hop count.

### Medium
- Admin access is determined purely by `profiles.role` fetched via the service-role client. If any client path or RLS policy allows users to mutate their own `role`, they can self-elevate to admin and access all admin routes.
  - Location: `server/src/routes/gumroad-api.ts:25`
  - Impact: privilege escalation if profile role is not strictly locked down.
  - Fix: enforce immutable `role` for non-admin users via RLS/DB constraints, or move admin determination to server-issued JWT custom claims.

## Notes / minor risks
- Global rate limiting is applied to all `/api/` routes, but admin endpoints with heavy operations (sync, cleanup) use the same limits and IP-only keys. Consider tighter, user-id-based limits for admin routes to reduce blast radius if an admin token is leaked.
  - Location: `server/src/index.ts:30`

## Open questions / assumptions
- Assumes no additional middleware verifies Gumroad webhook signatures or locks down `profiles.role` elsewhere. If these exist, please point me to them.
