# Dokploy (VPS) Deployment Guide

Deploy Roost on a VPS managed by Dokploy using `docker-compose.dokploy.yml`. The stack includes the full Supabase backend (Postgres, Auth, Realtime, Storage) and MinIO for file storage — everything self-hosted, no external accounts needed.

For failures and recovery, see [Dokploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md).

---

## 1. Generate Environment Variables

Open the **Env Generator** to create all required secrets and keys in your browser:

**[https://roost-env-generator.vercel.app](https://roost-env-generator.vercel.app)** (or open `dokploy-template/env-generator.html` locally)

The generator creates:
- **POSTGRES_PASSWORD**, **JWT_SECRET**, **SECRET_KEY_BASE** — random secrets
- **ANON_KEY**, **SERVICE_ROLE_KEY** — Supabase JWTs signed with your JWT_SECRET
- **MINIO_ROOT_PASSWORD** — MinIO storage credential
- Optional: SMTP, Stripe configuration

Copy the full output.

### Manual Generation (Alternative)

If you prefer CLI:

```bash
# Generate secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)
SECRET_KEY_BASE=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
```

Then generate `ANON_KEY` and `SERVICE_ROLE_KEY` using your `JWT_SECRET`:

```bash
# Generate HS256 JWT (requires node or python)
node -e "
  const crypto = require('crypto');
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
  const sig = crypto.createHmac('sha256','$JWT_SECRET').update(header+'.'+payload).digest('base64url');
  console.log(header+'.'+payload+'.'+sig);
"
# Repeat with role:'service_role' for SERVICE_ROLE_KEY
```

---

## 2. Deploy in Dokploy

1. Open your **Dokploy dashboard**.
2. Create a new application.
3. Choose **Docker Compose** deployment.
4. Set the **repository** to `https://github.com/msrbuilds/roost` (branch: `main`).
5. Set **compose path** to `docker-compose.dokploy.yml`.
6. Paste the generated env vars into the app's **Environment** section.
7. Under **Domains**, bind your domain to the `nginx` service on port `80`.
8. Hit **Deploy**.

---

## 3. DNS and TLS

1. Point your domain's DNS **A record** to the VPS IP address.
2. In Dokploy, enable HTTPS on the domain binding (Dokploy handles Let's Encrypt).
3. Wait for TLS certificate issuance (usually under a minute).

---

## 4. First Admin Setup

After deploying, sign up through the frontend at `https://your-domain.com`. Then promote that account to superadmin:

### Option A: From your VPS terminal (SSH)

```bash
# Find the db container name
docker ps --format '{{.Names}}' | grep db

# Run the SQL (replace the container name and email)
docker exec -it <APP_PREFIX>-db-1 psql -U postgres -d postgres -c \
  "SELECT setup_first_admin('your@email.com');"
```

### Option B: From Dokploy dashboard

1. Open your app in Dokploy.
2. Click the **db** service.
3. Go to the **Terminal** tab.
4. Run:

```bash
psql -U postgres -d postgres -c "SELECT setup_first_admin('your@email.com');"
```

### What it does

- Sets the user's role to `superadmin` in the `profiles` table.
- Gives full access to the admin dashboard (`/admin`).
- The `setup_first_admin()` function **auto-deletes itself** after first use — it's a one-time bootstrap only.

---

## Required Env Vars

| Variable | Description |
|----------|-------------|
| `ROOST_DOMAIN` | Your domain (e.g. `community.example.com`) |
| `POSTGRES_PASSWORD` | Database password (32+ chars) |
| `JWT_SECRET` | Shared JWT signing key (64+ chars, alphanumeric only) |
| `ANON_KEY` | Supabase anon JWT (signed with JWT_SECRET) |
| `SERVICE_ROLE_KEY` | Supabase service_role JWT (signed with JWT_SECRET) |
| `SECRET_KEY_BASE` | Realtime session encryption (64+ chars) |

---

## Storage

### Option A: MinIO (default — no config needed)

MinIO is included as the default S3-compatible storage backend. It works out of the box with zero configuration.

**How it works:**
- `minio` container runs the S3-compatible API.
- `minio-init` runs once on first deploy to create the `roost-uploads` bucket with public-read access.
- Supabase Storage API and the Roost backend both use MinIO for file uploads.
- Uploaded files are publicly accessible at `https://your-domain.com/files/roost-uploads/...`.

**Default env vars** (auto-generated, optional to include):

```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<generated>
MINIO_BUCKET=roost-uploads
```

If you omit all `MINIO_*` vars, MinIO runs with `minioadmin`/`minioadmin` defaults. For production, set a strong `MINIO_ROOT_PASSWORD`.

**Data persistence:** Stored in a `minio-data` Docker volume. Back up this volume to preserve uploaded files.

### Option B: AWS S3

To use AWS S3, set these env vars and remove all `MINIO_*` vars:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_FORCE_PATH_STYLE=false
VITE_S3_ENDPOINT=https://your-bucket-name.s3.us-east-1.amazonaws.com
```

**Important:**
- `S3_ENDPOINT` must be the AWS S3 regional URL (not empty) — this is what switches the stack from MinIO to AWS.
- `S3_FORCE_PATH_STYLE=false` enables virtual-hosted-style URLs that AWS requires.
- `VITE_S3_ENDPOINT` is the public URL the frontend uses to display uploaded files.
- MinIO will still run idle in the background (harmless, ~30MB) but won't be used.

---

## Post-Deploy Sanity Check

```bash
APP_PREFIX="your-app-prefix"  # e.g. roost-roost-472jet

# 1. All containers running
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$APP_PREFIX"

# 2. Backend health
curl -i https://your-domain.com/api/health

# 3. MinIO health
docker exec "${APP_PREFIX}-minio-1" curl -sf http://localhost:9000/minio/health/live && echo "OK"

# 4. Internal PostgREST via Kong
BACKEND="${APP_PREFIX}-backend-1"
docker exec "$BACKEND" sh -lc 'wget -S -qO- \
  --header="apikey: $SUPABASE_SECRET_KEY" \
  --header="Authorization: Bearer $SUPABASE_SECRET_KEY" \
  "http://kong:8000/rest/v1/profiles?select=count&limit=1"; echo'
```

Expected: all return `200`.

---

## Normal vs Problem States

**Normal (expected):**
- `realtime-tenant-fix` exits after running once.
- `minio-init` exits after creating the bucket.
- A single `502` right after deploy resolves on refresh.

**Problem:**
- `auth`, `rest`, or `storage` stuck restarting — check Postgres password and JWT_SECRET match.
- `minio` unhealthy — `MINIO_ROOT_PASSWORD` must be at least 8 characters.
- `/api/health` returns `503` — backend can't reach Kong; check container network.
- Persistent `403` from Supabase — ANON_KEY/SERVICE_ROLE_KEY not signed with the correct JWT_SECRET.
- File uploads fail — check backend logs for S3 connection errors.

See: [Dokploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md)

---

## Optional Env Vars

```env
APP_NAME=Roost
GOTRUE_AUTOCONFIRM=false

# SMTP (email verification, password reset)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@example.com

# Stripe (paid memberships)
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
```

If no SMTP is configured, set `GOTRUE_AUTOCONFIRM=true` to skip email verification during testing.

---

## Related Guides

- [Docker (VPS)](./docker-vps.md) — standalone Docker deployment with Traefik
- [Self-Hosted Setup](./self-hosted-setup.md) — complete self-hosted overview
- [Dokploy VPS Troubleshooting](./dockploy-vps-troubleshooting.md) — SQL recovery scripts and common fixes
