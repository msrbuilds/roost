# Dockploy (VPS) Deployment Guide

Minimal guide for deploying Roost on Dockploy using the existing `docker-compose.dokploy.yml` integration.

---

## What This Uses

- `docker-compose.dokploy.yml` (existing Dockploy stack)
- Supabase self-hosted services bundled in that compose file

This guide intentionally does not alter Dockploy integration internals.

---

## Step 1: Prepare Project and Installer Output

```bash
git clone https://github.com/your-org/roost.git
cd roost
bash install.sh
```

When prompted:

- Select `Dockploy (Self-hosted VPS)` as deployment target.

Installer outputs:

- `.env.local`
- `server/.env`
- `.env.dokploy` (values for Dockploy / `docker-compose.dokploy.yml`)

---

## Step 2: Create App in Dockploy

1. Open Dockploy dashboard.
2. Create a new application.
3. Choose **Docker Compose** deployment type.
4. Point it to `docker-compose.dokploy.yml`.

---

## Step 3: Configure Environment Variables

Add values from `.env.dokploy` into Dockploy environment settings.

Critical keys:

- `ROOST_DOMAIN`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `SECRET_KEY_BASE`

Also add optional SMTP/Stripe/S3 variables if needed.

---

## Step 4: Domain and SSL

1. Add your domain in Dockploy.
2. Ensure DNS A record points to VPS IP.
3. Let Dockploy provision TLS.

---

## Step 5: Deploy

Trigger deploy from Dockploy UI.

After deployment, verify:

```bash
curl https://your-domain.com/api/health
```

---

## Optional Local Compose Test (Outside Dockploy)

```bash
cp .env.dokploy .env
docker compose -f docker-compose.dokploy.yml up -d --build
```

---

## Troubleshooting

### Auth/API issues

- Re-check `ANON_KEY`, `SERVICE_ROLE_KEY`, and `JWT_SECRET` alignment.

### Domain not reachable

- Verify DNS A record.
- Verify Dockploy domain binding and TLS status.

### Service boot loops

- Inspect Dockploy logs per service.
- Validate required env values are present.
