# Install Script Usage Guide

The interactive `install.sh` script configures your entire Roost setup in one go.

---

## Running the Installer

```bash
bash install.sh
```

The script walks through 7 steps:

---

## Step 1: Dependency Check

The installer verifies:
- Node.js 18+ is installed
- npm is available
- git is available

If anything is missing, it tells you what to install.

---

## Step 2: Basic Configuration

```
? Community name [Roost]: My Awesome Community
? Community tagline [Learn, Build, Grow Together]: Where builders connect
? Your domain (or localhost for dev) [localhost]: mycommunity.com
```

- **Community name** — displayed in the header, emails, and meta tags
- **Tagline** — shown on the homepage and auth pages
- **Domain** — `localhost` for development, your actual domain for production

If you enter `localhost`, URLs default to `http://localhost:5173` and `http://localhost:3000`.
If you enter a domain, URLs use `https://your-domain.com`.

---

## Step 3: Database Provider

```
? Select your database provider:
  1) Supabase Cloud (Recommended - easiest setup)
  2) Supabase Self-hosted (Community Edition)
  3) MongoDB (Local/Atlas with Prisma)
```

### If you choose Supabase Cloud or Self-hosted:
```
? Supabase Project URL: https://abcdef.supabase.co
? Supabase Anon/Public Key: eyJ...
? Supabase Service Role Key (for server): eyJ...
```

### If you choose MongoDB:
```
? MongoDB Connection URL [mongodb://localhost:27017/roost]:
✓ JWT secret generated automatically
```

The JWT secret is auto-generated using `openssl rand -base64 32`.

---

## Step 4: Deployment Target

```
? Where will you deploy?
  1) Docker / Dokploy (Self-hosted VPS)
  2) Vercel (Frontend) + Separate Backend
  3) Netlify (Frontend) + Separate Backend
  4) Local Development Only
```

- **Docker** — generates docker-compose configuration
- **Vercel** — creates `vercel.json`
- **Netlify** — creates `netlify.toml`
- **Local** — no extra files, just dev setup

---

## Step 5: Optional Services

### File Storage
```
? File storage provider:
  1) AWS S3
  2) S3-Compatible (MinIO, Cloudflare R2, etc.)
  3) Local filesystem (dev only)
```

If you choose S3, you'll enter bucket name, region, and credentials.

### Email (SMTP)
```
? Configure email (SMTP) for notifications?
  1) Yes
  2) No, skip for now
```

If yes, you'll enter SMTP host, port, username, and password.

### Redis
```
? Configure Redis for caching & rate limiting?
  1) Yes
  2) No, use in-memory (fine for small communities)
```

### Gumroad Integration
```
? Enable Gumroad integration (paid memberships)?
  1) Yes
  2) No
```

If yes, you'll enter your Gumroad access token and seller ID. A webhook token is auto-generated.

---

## Step 6: File Generation

The installer creates:

| File | Description |
|------|-------------|
| `.env.local` | Frontend environment variables |
| `server/.env` | Backend environment variables |
| `vercel.json` | (if Vercel selected) |
| `netlify.toml` | (if Netlify selected) |

---

## Step 7: Install Dependencies

```
? Install npm dependencies now?
  1) Yes
  2) No, I'll do it later
```

If yes, the installer runs:
```bash
npm install                    # Frontend deps
cd server && npm install       # Backend deps

# If MongoDB selected:
npm install prisma @prisma/client
npx prisma generate
cd server && npm install jsonwebtoken bcryptjs
```

---

## After Installation

The installer shows a summary and quick start commands:

```
════════════════════════════════════════
  Installation Complete!
════════════════════════════════════════

  Community:    My Awesome Community
  Database:     supabase-cloud
  Deploy:       docker
  URL:          https://mycommunity.com

Quick Start:

  docker-compose up --build
```

---

## Re-running the Installer

You can run `bash install.sh` again at any time. It will overwrite the `.env.local` and `server/.env` files with new values.

**Tip**: Back up your existing env files before re-running:
```bash
cp .env.local .env.local.backup
cp server/.env server/.env.backup
```

---

## What the Installer Does NOT Do

- Run database migrations (you need to do this manually — see the database guide for your provider)
- Set up DNS records for your domain
- Configure your server's firewall
- Set up SSL certificates (handled by Traefik/Vercel/Netlify)
- Create your first admin user

For these steps, see the deployment guide for your chosen platform.
