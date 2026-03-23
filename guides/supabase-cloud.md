# Supabase Cloud Setup Guide

Step-by-step guide to set up Roost with Supabase Cloud (recommended for most users).

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- Node.js 18+ installed
- npm or yarn

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose your organization
4. Fill in:
   - **Project name**: `roost` (or your community name)
   - **Database password**: Generate a strong password and **save it** (you'll need it later)
   - **Region**: Choose the closest to your users
5. Click **Create new project**
6. Wait for the project to finish provisioning (~2 minutes)

---

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon/public key** — starts with `eyJ...` (this is safe to expose in frontend)
   - **service_role key** — starts with `eyJ...` (keep this SECRET, server-side only)

---

## Step 3: Run Database Migrations

You need to run the SQL migration files to create all tables, functions, and policies.

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

### Option B: Using SQL Editor (Manual)

1. Go to your Supabase dashboard > **SQL Editor**
2. Run each migration file **in order** (001, 002, 003, etc.):
   - Open each file from the `migrations/` folder
   - Paste the SQL into the editor
   - Click **Run**
3. Start with these critical ones:
   ```
   001_initial_schema.sql        — Core tables (profiles, groups, posts, etc.)
   002_rls_policies.sql          — Row-Level Security policies
   003_functions_triggers.sql    — Database functions and triggers
   004_gumroad_integration.sql   — Gumroad tables (optional)
   ```
4. Continue with all remaining migration files in numerical order

---

## Step 4: Configure Environment Variables

### Frontend (.env.local)

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Database Provider
VITE_DB_PROVIDER=supabase-cloud

# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...your-anon-key

# App
VITE_APP_NAME="Your Community Name"
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```

### Backend (server/.env)

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
NODE_ENV=development
PORT=3000

DB_PROVIDER=supabase-cloud
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIs...your-service-role-key

ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

---

## Step 5: Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

---

## Step 6: Start Development

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Backend
cd server && npm run dev
```

Or run both at once:

```bash
npm run dev:all
```

Visit `http://localhost:5173` — you should see the login page.

---

## Step 7: Create Your First Admin User

1. Click **Sign Up** and create an account
2. Go to Supabase dashboard > **Table Editor** > **profiles**
3. Find your user row
4. Change the `role` column from `user` to `superadmin`
5. Refresh the app — you now have full admin access

---

## Step 8: Enable Security Features (Recommended)

### Leaked Password Protection

1. Supabase Dashboard > **Authentication** > **Settings**
2. Under **Security**, enable **Leaked password protection**
3. This prevents users from using passwords exposed in data breaches

### Email Confirmation

1. Supabase Dashboard > **Authentication** > **Settings**
2. Under **Email**, configure:
   - **Enable email confirmations**: On
   - **Custom SMTP** (optional but recommended for production)

---

## Step 9: Configure Storage (AWS S3)

If you want image/file uploads:

1. Create an S3 bucket in AWS Console
2. Configure CORS on the bucket:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedOrigins": ["http://localhost:5173"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
3. Create an IAM user with S3 access
4. Add to your `server/.env`:
   ```env
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=your-secret
   ```
5. Add to `.env.local`:
   ```env
   VITE_AWS_REGION=us-east-1
   VITE_AWS_S3_BUCKET=your-bucket-name
   ```

---

## Troubleshooting

### "Permission denied" errors
- Check that RLS policies were created (migration 002)
- Verify your anon key is correct

### "User not found" after signup
- Ensure migration 003 (functions/triggers) was run — it creates the `handle_new_user()` trigger that auto-creates profiles

### Realtime not working
- Supabase Dashboard > **Database** > **Replication**
- Enable replication for: `posts`, `comments`, `messages`, `notifications`, `reactions`

### CORS errors
- Check `ALLOWED_ORIGINS` in `server/.env` matches your frontend URL exactly
- For Supabase, CORS is handled automatically

---

## Next Steps

- [Deploy with Docker](./docker-dokploy.md)
- [Deploy to Vercel](./vercel.md)
- [Configure Email Notifications](./email-setup.md)
