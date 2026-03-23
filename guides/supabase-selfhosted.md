# Supabase Self-Hosted Setup Guide

Step-by-step guide to set up Roost with your own self-hosted Supabase instance (Community Edition).

---

## Prerequisites

- A server/VPS with at least 2GB RAM and 2 CPU cores
- Docker and Docker Compose installed
- A domain name (optional but recommended)
- Node.js 18+ (for the Roost app)

---

## Step 1: Set Up Self-Hosted Supabase

### Option A: Using the Official Docker Setup

```bash
# Clone the Supabase repo
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy the example env file
cp .env.example .env
```

Edit `.env` and set these important values:

```env
# REQUIRED: Change these from defaults!
POSTGRES_PASSWORD=your-strong-db-password
JWT_SECRET=your-super-secret-jwt-token-at-least-32-chars
ANON_KEY=generate-this-using-jwt-secret
SERVICE_ROLE_KEY=generate-this-using-jwt-secret
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-dashboard-password

# Your domain (or IP)
SITE_URL=https://supabase.your-domain.com
API_EXTERNAL_URL=https://supabase.your-domain.com
```

### Generate JWT Keys

Use the Supabase JWT generator or manually create them:

```bash
# Install jwt-cli or use the online tool at:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

# The anon key needs these claims:
# { "role": "anon", "iss": "supabase", "iat": <now>, "exp": <10 years from now> }

# The service_role key needs:
# { "role": "service_role", "iss": "supabase", "iat": <now>, "exp": <10 years from now> }
```

### Start Supabase

```bash
docker compose up -d
```

Verify it's running:

```bash
# Check all services are healthy
docker compose ps

# Access the dashboard
# http://your-server-ip:8000 (or your configured domain)
```

### Option B: Using Supabase CLI (Local Dev)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize a local Supabase instance
supabase init
supabase start
```

This gives you a local Supabase at `http://localhost:54321` with auto-generated keys printed in the terminal.

---

## Step 2: Note Your Credentials

After setup, you'll need:

| Value | Where to Find |
|-------|--------------|
| **Supabase URL** | Your server URL (e.g., `http://your-ip:8000` or `https://supabase.your-domain.com`) |
| **Anon Key** | From `.env` file or `supabase status` output |
| **Service Role Key** | From `.env` file or `supabase status` output |
| **Database Password** | The `POSTGRES_PASSWORD` you set |

---

## Step 3: Run Database Migrations

### Option A: Direct Database Connection

```bash
# Connect directly to PostgreSQL
psql postgresql://postgres:your-password@your-server-ip:5432/postgres

# Run each migration file
\i migrations/001_initial_schema.sql
\i migrations/002_rls_policies.sql
\i migrations/003_functions_triggers.sql
# ... continue for all migration files
```

### Option B: Via Supabase Dashboard

1. Open your self-hosted Supabase dashboard
2. Go to **SQL Editor**
3. Paste and run each migration file in order

### Option C: Via Supabase CLI (if linked)

```bash
supabase link --project-ref your-project-ref
supabase db push
```

---

## Step 4: Configure Roost

### Frontend (.env.local)

```env
# Database Provider — use supabase-selfhosted
VITE_DB_PROVIDER=supabase-selfhosted

# Point to YOUR Supabase instance
VITE_SUPABASE_URL=http://your-server-ip:8000
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# App
VITE_APP_NAME="Your Community Name"
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```

### Backend (server/.env)

```env
NODE_ENV=development
PORT=3000

DB_PROVIDER=supabase-selfhosted
SUPABASE_URL=http://your-server-ip:8000
SUPABASE_SECRET_KEY=your-service-role-key

# Direct DB access (for backups)
SUPABASE_DB_PASSWORD=your-postgres-password
DB_HOST=your-server-ip
DB_PORT=5432

ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

---

## Step 5: Install and Run

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start development
npm run dev:all
```

---

## Step 6: Enable Realtime

Self-hosted Supabase requires explicit replication setup:

1. Open your Supabase dashboard
2. Go to **Database** > **Replication**
3. Enable replication for these tables:
   - `posts`
   - `comments`
   - `messages`
   - `notifications`
   - `reactions`
   - `live_session_messages`

---

## Step 7: Configure Email (Supabase Auth)

Self-hosted Supabase uses its own SMTP config for auth emails (confirmations, password resets):

Edit your Supabase `.env`:

```env
SMTP_ADMIN_EMAIL=admin@your-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SENDER_NAME=Your Community
```

Restart Supabase after changes:

```bash
docker compose restart
```

---

## Production Considerations

### Reverse Proxy (nginx/Traefik)

Set up SSL and proxy Supabase behind your domain:

```nginx
server {
    listen 443 ssl;
    server_name supabase.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Backups

Set up automated PostgreSQL backups:

```bash
# Add to crontab
0 2 * * * pg_dump -h localhost -U postgres roost > /backups/roost_$(date +\%Y\%m\%d).sql
```

### Resource Requirements

| Users | RAM | CPU | Disk |
|-------|-----|-----|------|
| < 100 | 2GB | 2 cores | 20GB |
| 100-1K | 4GB | 4 cores | 50GB |
| 1K-10K | 8GB | 4 cores | 100GB |

---

## Troubleshooting

### Services not starting
```bash
docker compose logs -f
# Check for port conflicts, missing env vars
```

### Auth not working
- Verify `JWT_SECRET` matches between Supabase config and your generated keys
- Check `SITE_URL` matches your actual URL

### Realtime not working
- Ensure the Realtime service is running: `docker compose ps`
- Check replication is enabled for the required tables

---

## Next Steps

- [Deploy Roost with Docker](./docker-dokploy.md)
- [Configure Email Notifications](./email-setup.md)
