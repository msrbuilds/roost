# Supabase Cloud Setup Guide

Step-by-step guide to set up Roost with Supabase Cloud (recommended for most users).

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- Node.js 22+ installed
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

## Step 3: Install the Database Schema

For a fresh project, open **SQL Editor**, paste the repository's `schema.sql`, and run it once. The consolidated schema creates the tables, functions, triggers, grants, and row-level security policies Roost requires.

`schema.sql` is a fresh-install schema rather than an in-place upgrade migration. Back up and migrate an existing Roost database separately instead of rerunning the entire file over it.

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
VITE_APP_URL=http://localhost:5000
VITE_API_URL=http://localhost:3000
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

ALLOWED_ORIGINS=http://localhost:5000
FRONTEND_URL=http://localhost:5000
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

Visit `http://localhost:5000` — you should see the login page.

---

## Step 7: Create Your First Admin User

1. Click **Sign Up** and create an account
2. Confirm the account email, then open the Supabase **SQL Editor** as the database operator.
3. Run the one-time bootstrap helper with that account's email:

   ```sql
   SELECT setup_first_admin('your-email@example.com');
   ```

4. Refresh the app — you now have full admin access. The bootstrap helper removes itself after use.

Do not change roles through the Table Editor. Roost protects those fields against direct client updates; manage subsequent roles through the authenticated superadmin tools.

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
       "AllowedOrigins": ["http://localhost:5000"],
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

- [Deploy with Docker (VPS)](./docker-vps.md)
- [Deploy with Dockploy (VPS)](./dockploy-vps.md)
- [Deploy to Vercel](./vercel.md)
