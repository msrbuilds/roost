# Roost - Dokploy Template

One-click deployment template for [Dokploy](https://dokploy.com).

## What's Included

This template deploys the **complete Roost stack**:

| Service | Image | Purpose |
|---------|-------|---------|
| **db** | supabase/postgres:15 | PostgreSQL with auto-initialized roles & Roost schema |
| **auth** | supabase/gotrue | User authentication (signup, login, JWT) |
| **rest** | postgrest | Auto-generated REST API from Postgres |
| **realtime** | supabase/realtime | WebSocket subscriptions for live data |
| **storage** | supabase/storage-api | File upload & image transformations |
| **kong** | kong:2.8.1 | API gateway routing |
| **frontend** | Built from repo | React app served by nginx |
| **backend** | Built from repo | Express.js API server |
| **nginx** | nginx:alpine | Reverse proxy (routes /api, /auth, /rest, etc.) |

## Deploy on Dokploy

1. Create a new **Project** in Dokploy
2. Add a **Compose** service -> Source: GitHub -> `msrbuilds/roost`
3. Set **Compose Path** to `docker-compose.dokploy.yml`
4. Add environment variables (see below)
5. Add domain -> Service: `nginx`, Port: `80`
6. Deploy

## Environment Variables

Generate secrets and paste into the Dokploy Environment tab:

```env
ROOST_DOMAIN=your-domain.com
APP_NAME=Roost

# Database
POSTGRES_PASSWORD=<generate-32-char-random>

# JWT (shared between Supabase services)
JWT_SECRET=<generate-64-char-random>
SECRET_KEY_BASE=<generate-64-char-random>

# Supabase Keys (generate from JWT_SECRET)
ANON_KEY=<generated-jwt-with-anon-role>
SERVICE_ROLE_KEY=<generated-jwt-with-service_role>

# Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@your-domain.com

# Stripe (optional)
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# S3 Storage (optional)
AWS_REGION=us-east-1
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Auto-Initialized Database

On first boot, the database automatically:
1. Creates all Supabase internal roles (`supabase_auth_admin`, `authenticator`, `anon`, `authenticated`, `service_role`, etc.)
2. Creates required schemas (`auth`, `storage`, `_realtime`, `extensions`)
3. Sets proper permissions and grants
4. Runs the Roost application schema (`schema.sql`)

No manual SQL setup required.

## Post-Deploy Setup

1. **Create your account** by signing up through the app
2. **Promote to admin** — SSH into your VPS and run:
   ```bash
   docker exec <db-container> psql -U postgres -c "SELECT setup_first_admin('your-email@example.com');"
   ```
3. **Configure branding** — Go to Admin -> Site Settings to customize logo, colors, and name

## File Structure

```
dokploy-template/
├── docker-compose.yml       # Standalone compose (relative paths)
├── nginx-proxy.conf         # Nginx reverse proxy config
├── README.md
└── volumes/
    ├── api/
    │   └── kong.yml          # Kong API gateway routing template
    └── db/
        └── 00-supabase-roles.sql  # Auto-creates Supabase roles on first boot
```

`docker-compose.dokploy.yml` at repo root is the Dokploy-optimized version (paths relative to repo root).
