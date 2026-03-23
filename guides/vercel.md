# Vercel Deployment Guide

Step-by-step guide to deploy Roost's frontend on Vercel. The backend must be deployed separately.

---

## Prerequisites

- A [Vercel](https://vercel.com) account
- A GitHub/GitLab repository with your Roost project
- Backend deployed separately (VPS, Railway, Render, etc.)
- Database configured (Supabase Cloud recommended for Vercel)

---

## Architecture

```
[Users] --> [Vercel - Frontend (React SPA)]
                |
                +--> [Backend Server (Express.js)]
                |        |
                |        +--> [Database (Supabase/MongoDB)]
                |        +--> [S3 Storage]
                |        +--> [Redis (optional)]
                |
                +--> [Supabase (direct client calls)]
```

Vercel serves the static frontend. API calls go to your separately hosted backend.

---

## Step 1: Push to Git

```bash
# Initialize git if not already
git init
git add .
git commit -m "Initial Roost setup"

# Push to GitHub
git remote add origin https://github.com/your-org/roost.git
git push -u origin main
```

---

## Step 2: Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your `roost` repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (leave as project root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

---

## Step 3: Configure Environment Variables

In Vercel project settings > **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_DB_PROVIDER` | `supabase-cloud` | Production, Preview |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `your-anon-key` | Production, Preview |
| `VITE_APP_NAME` | `Your Community` | Production, Preview |
| `VITE_APP_URL` | `https://your-vercel-domain.vercel.app` | Production |
| `VITE_API_URL` | `https://your-backend-url.com/api` | Production, Preview |
| `VITE_AWS_REGION` | `us-east-1` | Production, Preview |
| `VITE_AWS_S3_BUCKET` | `your-bucket` | Production, Preview |
| `VITE_ENABLE_SIGNUP` | `true` | Production |
| `VITE_GUMROAD_ENABLED` | `false` | Production |

---

## Step 4: Deploy

Click **Deploy**. Vercel will:
1. Clone your repo
2. Run `npm install`
3. Run `npm run build` (with your env vars injected)
4. Deploy the `dist/` folder to their CDN

---

## Step 5: Configure Custom Domain (Optional)

1. Vercel project > **Settings** > **Domains**
2. Add your custom domain (e.g., `roost.your-domain.com`)
3. Update DNS:
   - **A Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`
4. SSL is automatic

After adding the domain, update your env vars:
- `VITE_APP_URL` = `https://roost.your-domain.com`

---

## Step 6: Deploy the Backend

The Express.js backend needs a separate host. Options:

### Option A: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
cd server
railway login
railway init
railway up
```

Set environment variables in Railway dashboard.

### Option B: Render

1. Go to [render.com](https://render.com)
2. New > **Web Service**
3. Connect your repo
4. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables

### Option C: Your Own VPS

```bash
# On your server
cd roost/server
npm install
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name roost-backend
pm2 save
pm2 startup
```

### Option D: Vercel Serverless Functions (Advanced)

You can adapt the Express backend to Vercel serverless functions, but this requires restructuring the routes. Not recommended unless you're familiar with serverless patterns.

---

## Step 7: Update CORS

Make sure your backend allows requests from Vercel:

In `server/.env`:
```env
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app,https://roost.your-domain.com
FRONTEND_URL=https://roost.your-domain.com
```

---

## Preview Deployments

Vercel automatically creates preview deployments for every pull request. To use them:

1. Set **Preview** environment variables in Vercel
2. Use a different `VITE_APP_URL` for previews or leave it as the preview URL

---

## Vercel Configuration

The `vercel.json` file is already configured:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The rewrite rule ensures client-side routing works (all paths serve `index.html`).

---

## Troubleshooting

### Build fails with "missing env vars"
- Make sure all `VITE_*` variables are set in Vercel dashboard
- Check the build logs for specific errors

### API calls fail (CORS)
- Verify `ALLOWED_ORIGINS` on your backend includes the Vercel URL
- Check browser console for specific CORS error messages

### Routes return 404
- Ensure `vercel.json` has the rewrite rule
- Clear Vercel cache: **Settings** > **Functions** > **Purge Cache**

### Environment variables not taking effect
- Vercel requires a **redeploy** after changing env vars
- Go to **Deployments** > latest > **Redeploy**

---

## Next Steps

- [Configure Email Notifications](./email-setup.md)
- [MongoDB Setup](./mongodb-prisma.md) (if using MongoDB)
