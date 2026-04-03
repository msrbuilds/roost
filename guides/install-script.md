# Install Script Usage Guide

The interactive `install.sh` script now supports full VPS setup flow plus deployment-specific config generation.

---

## Run the Installer

```bash
bash install.sh
```

The script runs 7 steps.

---

## Step 1: System Prep + Dependency Check

You can choose:

- **Auto-install mode (Ubuntu/Debian VPS)**:
  - Node.js 20+
  - Git
  - Docker + Docker Compose plugin
  - Core system packages
- **Manual mode**: script only validates dependencies.

---

## Step 2: Basic App Configuration

Prompts include:

```text
? Community name [Roost]
? Community tagline [Learn, Build, Grow Together]
? Your domain (or localhost for dev) [localhost]
```

`localhost` uses local HTTP URLs.
Domain values use HTTPS URLs.
For Docker VPS target, `localhost` is not allowed because SSL is enforced.

---

## Step 3: Database Provider

```text
1) Supabase Cloud
2) Supabase Self-hosted
3) MongoDB (Prisma)
```

Provider-specific credentials are collected.

For MongoDB, JWT secret is generated automatically.

---

## Step 4: Deployment Target

```text
1) Docker (Self-hosted VPS)
2) Dockploy (Self-hosted VPS)
3) Vercel (Frontend + separate backend)
4) Netlify (Frontend + separate backend)
5) Local Development Only
```

Important:

- Docker and Dockploy targets verify Docker runtime.
- Docker target requires a real domain + Let’s Encrypt email for built-in SSL.
- Dockploy target is Supabase self-hosted by design.

---

## Step 5: Optional Services

Prompts include:

- Storage (AWS S3 / S3-compatible / local)
- SMTP
- Redis
- Stripe

For Docker target:

- MongoDB default URL is switched to `mongodb://mongo:27017/roost`.
- Redis default URL is `redis://redis:6379`.
- Traefik reverse proxy + Let's Encrypt TLS are configured automatically.

---

## Step 6: File Generation

Always generated:

- `.env.local`
- `server/.env`

Deployment-specific:

- `Docker`: `.env` (compose runtime env)
- `Dockploy`: `.env.dokploy`
- `Vercel`: `vercel.json`
- `Netlify`: `netlify.toml`

---

## Step 7: Dependency Installation

If you choose yes, script installs frontend and backend npm dependencies.

For MongoDB mode, it also installs:

- `prisma`
- `@prisma/client`
- `jsonwebtoken`
- `bcryptjs`

---

## Quick Start Output by Target

### Docker

```bash
docker compose up -d --build
```

### Dockploy

Use `.env.dokploy` values in Dockploy environment UI (or run manually with `docker-compose.dokploy.yml`).

### Vercel / Netlify

Frontend deploy commands are shown; backend remains separate.

---

## Re-running the Installer

You can run `bash install.sh` any time. It overwrites generated env/config files.

Back up current values first if needed:

```bash
cp .env.local .env.local.backup
cp server/.env server/.env.backup
cp .env .env.backup 2>/dev/null || true
cp .env.dokploy .env.dokploy.backup 2>/dev/null || true
```

---

## What Installer Does Not Do Automatically

- DNS record setup
- Database schema execution (`schema.sql` / `prisma db push`)
- First admin creation

Use deployment/database guides for those operational steps.
