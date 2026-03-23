# Roost - Dokploy Template

One-click deployment template for [Dokploy](https://dokploy.com).

## What's Included

This template deploys the **complete Roost stack**:

| Service | Image | Purpose |
|---------|-------|---------|
| **db** | supabase/postgres:15 | PostgreSQL database with Roost schema auto-applied |
| **auth** | supabase/gotrue | User authentication (signup, login, JWT) |
| **rest** | postgrest | Auto-generated REST API from Postgres |
| **realtime** | supabase/realtime | WebSocket subscriptions for live data |
| **storage** | supabase/storage-api | File upload & image transformations |
| **kong** | kong:2.8.1 | API gateway routing |
| **frontend** | Built from repo | React app served by nginx |
| **backend** | Built from repo | Express.js API server |
| **nginx** | nginx:alpine | Reverse proxy (routes /api, /auth, /rest, etc.) |

## Auto-Generated Secrets

The template automatically generates:
- PostgreSQL password (32 chars)
- JWT secret (64 chars)
- Supabase anon key and service role key

## Post-Deploy Setup

1. **Create first admin**: Go to Dokploy terminal for `db` service and run:
   ```sql
   psql -U postgres -c "SELECT setup_first_admin('your-email@example.com');"
   ```

2. **Configure email** (optional): Update SMTP variables in Dokploy environment settings

3. **Configure Stripe** (optional): Add Stripe keys in environment settings

## File Structure

```
dokploy-template/
├── docker-compose.yml    # All services
├── template.toml         # Dokploy config (variables, domains, mounts)
├── volumes/
│   └── api/
│       └── kong.yml      # Kong API gateway routing
└── README.md
```

The `schema.sql` in the repo root is mounted into Postgres and runs automatically on first boot.
