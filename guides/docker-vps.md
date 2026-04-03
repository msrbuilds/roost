# Docker (VPS) Deployment Guide

Complete VPS deployment guide for Roost using `docker-compose.yml`.

This Docker path now includes Traefik + Let's Encrypt SSL by default.

---

## What This Covers

- Frontend + backend deployment on a VPS
- Built-in Traefik reverse proxy
- Automatic Let's Encrypt SSL certificates
- Supabase Cloud / Supabase Self-hosted / MongoDB
- Optional Redis container profile

---

## Prerequisites

- Ubuntu/Debian VPS recommended (2 vCPU, 4GB RAM minimum)
- Domain pointed to your VPS public IP
- Ports `80` and `443` open in firewall/security group
- Git access to your Roost repository

---

## Step 1: Clone and Run Installer

```bash
git clone https://github.com/msrbuilds/roost.git
cd roost
bash install.sh
```

When prompted:

1. Choose `Docker (Self-hosted VPS)` target.
2. Enter a real domain (not `localhost`).
3. Enter Let’s Encrypt email (required).
4. Choose database provider and optional services.

Installer generates:

- `.env.local`
- `server/.env`
- `.env` (Docker runtime env, including Traefik/SSL settings)

---

## Step 2: Database Provider Paths

### Supabase Cloud

- Choose `Supabase Cloud` in installer.
- Provide project URL, anon key, service role key.
- Run `schema.sql` in Supabase SQL Editor (or Supabase CLI).

### Supabase Self-hosted

- Choose `Supabase Self-hosted` in installer.
- Provide your self-hosted Supabase URL and keys.
- Use [Supabase Self-Hosted Guide](./supabase-selfhosted.md) for Supabase stack setup.

### MongoDB

- Choose `MongoDB` in installer.
- If you keep default URL, installer enables Docker Mongo profile:
  - `DATABASE_URL=mongodb://mongo:27017/roost`
  - `COMPOSE_PROFILES=mongodb`

MongoDB will run automatically with `docker compose up`.

---

## Step 3: Deploy

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f traefik
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Step 4: Verify SSL + Routing

```bash
curl https://your-domain.com/api/health
curl -I https://your-domain.com
```

Expected:

- Frontend served over HTTPS at root path
- Backend reachable at `/api/*` over same domain

---

## Traffic Model

- Traefik listens on host ports `80` and `443`.
- Frontend/backend are internal-only containers (not directly published to host).
- HTTP is redirected to HTTPS.

---

## Updates

```bash
git pull
docker compose up -d --build
```

---

## Troubleshooting

### SSL certificate not issued

- Confirm DNS A record points to VPS public IP.
- Confirm ports 80/443 are open.
- Check logs: `docker compose logs -f traefik`

### Containers fail due missing env values

- Re-run `bash install.sh` and choose Docker target again.
- Confirm `.env` exists in project root.

### MongoDB connection errors

- Check `docker compose ps` includes `roost-mongo`.
- Confirm `.env` has `COMPOSE_PROFILES=mongodb`.

### Redis connection errors

- Confirm `.env` has `REDIS_URL=redis://redis:6379`.
- Confirm `.env` has `COMPOSE_PROFILES=redis` (or `mongodb,redis`).

### CORS errors

- Ensure `ALLOWED_ORIGINS` and `FRONTEND_URL` in `.env` match your production domain.

---

## Next Guides

- [Dockploy (VPS)](./dockploy-vps.md)
- [Netlify](./netlify.md)
- [Vercel](./vercel.md)
