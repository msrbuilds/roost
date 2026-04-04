# Self-Hosted Setup Guide

Complete guide for deploying Roost on your own infrastructure.

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (Cloud or Self-hosted) OR MongoDB
- S3-compatible storage (AWS S3, MinIO, or Cloudflare R2)
- (Optional) SMTP server for email notifications
- (Optional) Redis for caching and rate limiting
- (Optional) Stripe account for paid memberships

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url> roost
cd roost
bash install.sh
```

The interactive installer will guide you through configuring:
- Community name and branding
- Database provider (Supabase Cloud, Supabase Self-hosted, or MongoDB)
- Deployment target (Docker VPS, Dockploy VPS, Vercel, Netlify, or Local)
- Optional services (S3 storage, email, Redis, Stripe)

### 2. Set Up the Database

#### Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com) (or use self-hosted Supabase)
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy the entire contents of `schema.sql` and paste it into the SQL Editor
4. Click **Run** — this creates all 41 tables, functions, triggers, and security policies

#### MongoDB

```bash
npx prisma generate
npx prisma db push
```

### 3. Create First Admin User

1. Start the app: `npm run dev:all`
2. Sign up via the app at `http://localhost:5173/signup`
3. Go to your Supabase dashboard → **SQL Editor**
4. Run:
   ```sql
   SELECT setup_first_admin('your-email@example.com');
   ```
   (Use the email you signed up with)
5. Refresh the app — you now have full superadmin access

> **Note**: The `setup_first_admin` function is a one-time bootstrap helper. It automatically deletes itself after promoting the first superadmin, so it cannot be misused. After this, manage roles from the Admin panel in the app.
>
> **Do NOT use the Supabase Table Editor** to change roles directly — a database trigger blocks role changes unless done via service role (SQL Editor) or by a superadmin through the app.

### 4. Start the App

```bash
# Development
npm run dev:all

# Production (Docker)
docker compose up --build -d
```

---

## Deployment Options

### Docker (Recommended for Self-Hosting)

```bash
# Configure environment variables in .env.local and server/.env
# Then build and run:
docker compose up --build -d

# View logs
docker compose logs -f

# Update
docker compose down
docker compose up --build -d
```

The Docker setup includes:
- Frontend served by nginx with gzip, caching, and security headers
- Backend with health checks and graceful shutdown
- Built-in Traefik reverse proxy with automatic Let's Encrypt SSL
- Optional MongoDB/Redis/MinIO profiles (when configured by installer)

Detailed VPS guides:
- [Docker (VPS)](./docker-vps.md)
- [Dockploy (VPS)](./dockploy-vps.md)

### Vercel + VPS

Deploy frontend to Vercel, backend to a VPS or Railway:

```bash
# Frontend
vercel deploy

# Backend (on VPS)
cd server && npm run build && npm start
```

### Netlify + VPS

Deploy frontend to Netlify, backend separately:

```bash
# Frontend
netlify deploy --prod

# Backend (on VPS)
cd server && npm run build && npm start
```

---

## Stripe Setup (Paid Memberships)

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create a Product and Price in the Stripe Dashboard
3. Configure the Customer Portal in Stripe settings
4. Add webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
5. Set environment variables:
   ```env
   # Frontend (.env.local)
   VITE_STRIPE_ENABLED=true

   # Backend (server/.env)
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   ```

### Testing Stripe Locally

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use the webhook signing secret from the CLI output
```

---

## S3 Storage Setup

### AWS S3

1. Create an S3 bucket with public read access for uploads
2. Create an IAM user with S3 access
3. Set environment variables:
   ```env
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

### MinIO (Self-Hosted S3)

If you deploy with `Docker (VPS)` and choose `S3-Compatible` -> `Self-host MinIO on this VPS`, the installer configures MinIO automatically in Docker Compose.

For manual/local MinIO setup, you can still run:

```bash
# Run MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password \
  minio/minio server /data --console-address ":9001"
```

Set `S3_ENDPOINT=http://localhost:9000` in your backend `.env`.

### Cloudflare R2

Use R2 with S3-compatible API. Set `S3_ENDPOINT` to your R2 endpoint.

---

## Environment Variables Reference

### Frontend (.env.local)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_APP_NAME` | No | Roost | Community name |
| `VITE_APP_TAGLINE` | No | Learn, Build, Grow Together | Tagline |
| `VITE_DB_PROVIDER` | Yes | supabase-cloud | Database provider |
| `VITE_SUPABASE_URL` | Yes* | — | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes* | — | Supabase anon key |
| `VITE_API_URL` | Yes | http://localhost:3000 | Backend API URL |
| `VITE_AWS_REGION` | No | us-east-1 | S3 region |
| `VITE_AWS_S3_BUCKET` | No | — | S3 bucket name |
| `VITE_S3_ENDPOINT` | No | — | Public S3-compatible endpoint (MinIO/R2) |
| `VITE_STRIPE_ENABLED` | No | false | Enable Stripe payments |
| `VITE_ENABLE_SIGNUP` | No | true | Allow new signups |
| `VITE_ENABLE_SHOWCASE` | No | true | Enable project showcase |
| `VITE_ENABLE_LIVE_ROOM` | No | true | Enable live sessions |
| `VITE_ENABLE_LEADERBOARD` | No | true | Enable points/leaderboard |

*Required for Supabase providers

### Backend (server/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_PROVIDER` | Yes | supabase-cloud | Must match frontend |
| `SUPABASE_URL` | Yes* | — | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes* | — | Supabase service role key |
| `AWS_ACCESS_KEY_ID` | No | — | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | No | — | S3 secret key |
| `S3_ENDPOINT` | No | — | S3-compatible endpoint URL |
| `SMTP_HOST` | No | — | SMTP server host |
| `SMTP_PORT` | No | 587 | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `REDIS_URL` | No | — | Redis connection URL |
| `STRIPE_SECRET_KEY` | No | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook secret |
| `STRIPE_PRICE_ID` | No | — | Default subscription price |
| `ALLOWED_ORIGINS` | Yes | http://localhost:5173 | CORS origins |
| `FRONTEND_URL` | Yes | http://localhost:5173 | Frontend URL |

---

## Feature Flags

All features can be toggled via environment variables:

| Feature | Env Variable | Default |
|---------|-------------|---------|
| User signup | `VITE_ENABLE_SIGNUP` | true |
| Stripe payments | `VITE_STRIPE_ENABLED` | false |
| Project showcase | `VITE_ENABLE_SHOWCASE` | true |
| Live room | `VITE_ENABLE_LIVE_ROOM` | true |
| Leaderboard | `VITE_ENABLE_LEADERBOARD` | true |
| Activations | `VITE_ENABLE_ACTIVATIONS` | false |

---

## Updating

```bash
# Pull latest changes
git pull

# Rebuild
npm run build:all

# Docker
docker compose up --build -d

# Check for new migrations
ls migrations/
# Run any new migrations in Supabase SQL Editor
```
