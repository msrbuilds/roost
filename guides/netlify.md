# Netlify Deployment Guide

Step-by-step guide to deploy Roost's frontend on Netlify. The backend must be deployed separately.

---

## Prerequisites

- A [Netlify](https://netlify.com) account
- A GitHub/GitLab repository with your Roost project
- Backend deployed separately (VPS, Railway, Render, etc.)
- Database configured (Supabase Cloud recommended)

---

## Step 1: Push to Git

```bash
git init
git add .
git commit -m "Initial Roost setup"
git remote add origin https://github.com/your-org/roost.git
git push -u origin main
```

---

## Step 2: Import to Netlify

### Via Netlify Dashboard

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** > **Import an existing project**
3. Choose your Git provider and select the `roost` repository
4. Configure build settings:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy site**

### Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

---

## Step 3: Configure Environment Variables

Go to **Site settings** > **Environment variables** and add:

| Variable | Value |
|----------|-------|
| `VITE_DB_PROVIDER` | `supabase-cloud` |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `your-anon-key` |
| `VITE_APP_NAME` | `Your Community` |
| `VITE_APP_URL` | `https://your-site.netlify.app` |
| `VITE_API_URL` | `https://your-backend-url.com/api` |
| `VITE_AWS_REGION` | `us-east-1` |
| `VITE_AWS_S3_BUCKET` | `your-bucket` |
| `VITE_ENABLE_SIGNUP` | `true` |
| `NODE_VERSION` | `20` |

After adding variables, trigger a redeploy: **Deploys** > **Trigger deploy** > **Deploy site**.

---

## Step 4: Custom Domain (Optional)

1. **Site settings** > **Domain management** > **Add custom domain**
2. Enter your domain (e.g., `roost.your-domain.com`)
3. Update DNS records:
   - **CNAME**: `your-site.netlify.app`
   - Or use Netlify DNS for automatic configuration
4. SSL is provisioned automatically via Let's Encrypt

Update your env var:
- `VITE_APP_URL` = `https://roost.your-domain.com`

---

## Step 5: Deploy the Backend

Same options as the Vercel guide — the backend needs a separate host:

### Railway
```bash
cd server
railway login && railway init && railway up
```

### Render
1. New > Web Service > Connect repo
2. Root directory: `server`
3. Build: `npm install && npm run build`
4. Start: `npm start`

### VPS with PM2
```bash
cd server && npm install && npm run build
pm2 start dist/index.js --name roost-backend
```

---

## Step 6: Update CORS

In your backend `server/.env`:
```env
ALLOWED_ORIGINS=https://your-site.netlify.app,https://roost.your-domain.com
FRONTEND_URL=https://roost.your-domain.com
```

---

## Netlify Configuration

The `netlify.toml` is already configured:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

The redirect rule ensures SPA routing works. Asset caching is set to 1 year for optimal performance.

---

## Deploy Previews

Netlify automatically creates deploy previews for pull requests:

1. Open a PR on GitHub
2. Netlify builds and deploys a preview
3. A link appears in the PR comments
4. Preview uses the same env vars as production (unless overridden)

---

## Build Plugins (Optional)

### Lighthouse Plugin

```bash
netlify plugins:install netlify-plugin-lighthouse
```

Automatically runs Lighthouse audits on every deploy.

### Cache Plugin

Netlify caches `node_modules` by default. For faster builds, you can also cache the Vite build cache:

Add to `netlify.toml`:
```toml
[[plugins]]
  package = "@netlify/plugin-caching"
  [plugins.inputs]
    paths = ["node_modules/.vite"]
```

---

## Troubleshooting

### Build fails
- Check build logs in **Deploys** tab
- Ensure `NODE_VERSION=20` is set in environment variables
- Verify all `VITE_*` env vars are configured

### 404 on page refresh
- Ensure the `[[redirects]]` rule is in `netlify.toml`
- Or add a `public/_redirects` file with: `/* /index.html 200`

### API calls fail
- Check CORS settings on your backend
- Verify `VITE_API_URL` points to your backend
- Test with: `curl https://your-backend-url.com/api/health`

### Environment variables not working
- Variables must start with `VITE_` to be available in the frontend
- Redeploy after changing variables

---

## Next Steps

- [Configure Email Notifications](./email-setup.md)
- [Set up Storage (S3)](./storage-setup.md)
