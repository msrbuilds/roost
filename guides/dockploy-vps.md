# Dockploy (VPS) Deployment Guide

Deploy Roost on a VPS managed by Dockploy using `docker-compose.dokploy.yml`.

Use this guide for the happy path. For failures and recovery, use [Dockploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md).

---

## Quick Start (Recommended)

1. Run installer:

```bash
bash install.sh
```

2. Choose:
- `Supabase Self-hosted`
- `Auto-generate JWT/anon/service keys`
- `Dockploy (Self-hosted VPS)`

3. Installer writes `.env.dokploy`.
4. In Dockploy app env, paste values from `.env.dokploy`.
5. Deploy with compose file `docker-compose.dokploy.yml`.

---

## Required Env Vars (Manual Mode)

If you skip installer-generated env, set these in Dockploy before first deploy:

```env
ROOST_DOMAIN=community.example.com
POSTGRES_PASSWORD=change-me-strong-db-password
JWT_SECRET=change-me-very-long-random-secret
ANON_KEY=change-me-jwt-anon-key
SERVICE_ROLE_KEY=change-me-jwt-service-role-key
SECRET_KEY_BASE=change-me-very-long-random-secret
```

Notes:
- Deploy fails fast if required keys are missing.
- `ANON_KEY` and `SERVICE_ROLE_KEY` must be signed with the same `JWT_SECRET`.
- If you need manual key generation, use the snippets in [Install Script Guide](./install-script.md).

---

## Deploy in Dockploy

1. Open Dockploy dashboard.
2. Create/open Roost app.
3. Choose Docker Compose deployment.
4. Set compose path to `docker-compose.dokploy.yml`.
5. Add env vars.
6. Deploy.

---

## Domain and TLS

1. Bind `ROOST_DOMAIN` to the app in Dockploy.
2. Point DNS A record to VPS IP.
3. Wait for TLS issuance.

---

## Post-Deploy Sanity Check

Run:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-472jet

# 1) containers

docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$APP_PREFIX"

# 2) external backend health
curl -i https://your-domain.com/api/health

# 3) internal rest path from backend -> kong
BACKEND="${APP_PREFIX}-backend-1"
docker exec "$BACKEND" sh -lc 'wget -S -qO- \
  --header="apikey: $SUPABASE_SECRET_KEY" \
  --header="Authorization: Bearer $SUPABASE_SECRET_KEY" \
  "http://kong:8000/rest/v1/profiles?select=count&limit=1"; echo'
```

Expected:
- `/api/health` returns `200` with `supabase: connected`.
- Internal `/rest/v1` call returns `200`.

---

## Normal vs Problem States

Normal:
- `realtime-tenant-fix` container exits after running once.
- A single transient browser `502` right after restarts can happen; hard refresh and retest.

Problem:
- `auth`, `rest`, or `storage` stuck restarting.
- `/api/health` returns `503`.
- Browser Supabase requests return persistent `403` or `502`.

Use: [Dockploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md)

---

## Optional Env Vars

```env
APP_NAME=Roost
GOTRUE_AUTOCONFIRM=false

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@example.com

STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

AWS_REGION=us-east-1
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## Related Guides

- [Docker (VPS)](./docker-vps.md)
- [Self-Hosted Setup](./self-hosted-setup.md)
- [Dockploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md)
