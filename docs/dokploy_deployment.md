# Dokploy Deployment Guide

This guide explains how to deploy your Roost platform using Dokploy, a self-hosted Platform as a Service (PaaS).

## What is Dokploy?

Dokploy is an open-source, self-hosted alternative to Heroku, Vercel, and Netlify. It uses Docker for containerization and Traefik for routing and load balancing, providing:

- 🚀 Simple application deployment
- 🔄 Automatic deployments via Git webhooks
- 🔒 Automatic SSL certificates (Let's Encrypt)
- 📊 Real-time monitoring (CPU, memory, disk, network)
- 🗄️ Built-in database management
- 🌐 Multi-server support
- 📝 Complete API and CLI access

---

## Prerequisites

1. **VPS Server** - DigitalOcean, Hetzner, Vultr, or any VPS provider
   - Minimum: 2 CPU cores, 4GB RAM, 50GB storage
   - Recommended: 4 CPU cores, 8GB RAM, 100GB storage
   - OS: Ubuntu 22.04 LTS or later

2. **Domain Name** - For your application (e.g., `community.yourdomain.com`)

3. **GitHub Repository** - Your code repository

---

## Step 1: Server Setup

### 1.1 Create VPS

Choose a provider and create a server:

**DigitalOcean:**
```bash
# Create a Droplet
# - Ubuntu 22.04 LTS
# - 4GB RAM / 2 CPUs
# - Choose datacenter region
```

**Hetzner (Cost-effective):**
```bash
# Create a Cloud Server
# - Ubuntu 22.04
# - CX21 (2 vCPU, 4GB RAM)
```

### 1.2 Initial Server Configuration

SSH into your server:

```bash
ssh root@your-server-ip
```

Update system:

```bash
apt update && apt upgrade -y
```

Create a non-root user (optional but recommended):

```bash
adduser dokploy
usermod -aG sudo dokploy
su - dokploy
```

---

## Step 2: Install Dokploy

### 2.1 Run Installation Script

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

This will:
- Install Docker and Docker Compose
- Install Traefik (reverse proxy)
- Set up Dokploy dashboard
- Configure SSL certificates

### 2.2 Access Dokploy Dashboard

Once installation completes:

1. Open browser: `http://your-server-ip:3000`
2. Create admin account
3. Log in to dashboard

---

## Step 3: Configure Domain

### 3.1 DNS Settings

Point your domain to your server:

```
Type: A Record
Name: @ (or subdomain like 'community')
Value: your-server-ip
TTL: 3600
```

### 3.2 Configure Domain in Dokploy

1. Go to **Settings** → **Server**
2. Add your domain
3. Enable SSL (automatic via Let's Encrypt)

---

## Step 4: Prepare Application for Deployment

### 4.1 Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start application
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### 4.2 Create .dockerignore

Create `.dockerignore`:

```
node_modules
.git
.env
.env.local
dist
build
*.log
.DS_Store
```

### 4.3 Create docker-compose.yml (for local testing)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
      - VITE_GUMROAD_WEBHOOK_URL=${VITE_GUMROAD_WEBHOOK_URL}
    restart: unless-stopped
```

### 4.4 Test Docker Build Locally

```bash
# Build image
docker build -t roost .

# Run container
docker run -p 3000:3000 roost

# Test in browser
# http://localhost:3000
```

---

## Step 5: Deploy to Dokploy

### 5.1 Create New Application

1. In Dokploy dashboard, click **Create Application**
2. Choose **Git** as source
3. Connect your GitHub repository
4. Select branch (e.g., `main`)

### 5.2 Configure Build Settings

**Build Type:** Docker

**Dockerfile Path:** `./Dockerfile`

**Build Context:** `/`

### 5.3 Set Environment Variables

Add all required environment variables:

```env
NODE_ENV=production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AWS_S3_BUCKET=your-bucket-name
VITE_AWS_REGION=us-east-1
VITE_GUMROAD_WEBHOOK_URL=https://yourdomain.com/api/webhooks/gumroad
```

### 5.4 Configure Domain

1. Go to **Domains** tab
2. Add your domain: `community.yourdomain.com`
3. Enable **Generate SSL Certificate**
4. Save

### 5.5 Deploy

1. Click **Deploy** button
2. Monitor build logs in real-time
3. Wait for deployment to complete

---

## Step 6: Set Up Automatic Deployments

### 6.1 Configure Webhook

1. In Dokploy, go to **Settings** → **Git**
2. Copy the webhook URL
3. Go to GitHub repository → **Settings** → **Webhooks**
4. Add webhook:
   - Payload URL: (paste Dokploy webhook URL)
   - Content type: `application/json`
   - Events: `Just the push event`
   - Active: ✓

Now every push to `main` branch will trigger automatic deployment!

---

## Step 7: Configure Gumroad Webhook

Update Gumroad ping URL to point to your Dokploy deployment:

```
https://community.yourdomain.com/api/webhooks/gumroad
```

---

## Step 8: Monitoring & Maintenance

### 8.1 Monitor Resources

In Dokploy dashboard:
- **CPU Usage** - Real-time CPU metrics
- **Memory Usage** - RAM consumption
- **Disk Usage** - Storage utilization
- **Network** - Bandwidth usage

### 8.2 View Logs

1. Go to **Logs** tab
2. View real-time application logs
3. Filter by time range
4. Download logs for analysis

### 8.3 Access Container Terminal

1. Go to **Terminal** tab
2. Execute commands inside container:

```bash
# Check Node.js version
node --version

# View environment variables
env | grep VITE

# Check running processes
ps aux
```

### 8.4 Set Up Alerts

1. Go to **Settings** → **Notifications**
2. Configure notification channels:
   - Slack
   - Discord
   - Telegram
   - Email
3. Set alert conditions:
   - Deployment failures
   - High CPU usage (>80%)
   - High memory usage (>90%)
   - Application crashes

---

## Step 9: Database Backups (Optional)

If you're running PostgreSQL on Dokploy:

### 9.1 Configure Automated Backups

1. Go to **Databases** tab
2. Select your database
3. Click **Backups**
4. Configure:
   - Frequency: Daily at 2 AM
   - Retention: 7 days
   - Destination: S3 bucket

### 9.2 Manual Backup

```bash
# SSH into server
ssh dokploy@your-server-ip

# Create backup
docker exec postgres-container pg_dump -U postgres dbname > backup.sql

# Download backup
scp dokploy@your-server-ip:~/backup.sql ./
```

---

## Step 10: Scaling

### 10.1 Vertical Scaling (Upgrade Server)

1. Upgrade VPS resources (more CPU/RAM)
2. Restart Dokploy services
3. No code changes needed

### 10.2 Horizontal Scaling (Multiple Servers)

Dokploy supports Docker Swarm for multi-node deployments:

1. Set up additional servers
2. Configure Docker Swarm
3. Deploy to swarm cluster
4. Dokploy manages load balancing

---

## Troubleshooting

### Build Fails

**Check build logs:**
1. Go to **Deployments** tab
2. Click on failed deployment
3. Review error messages

**Common issues:**
- Missing environment variables
- Dockerfile syntax errors
- Build dependencies not installed

### Application Not Accessible

**Check domain configuration:**
```bash
# Test DNS resolution
nslookup community.yourdomain.com

# Check if port is open
curl -I https://community.yourdomain.com
```

**Check SSL certificate:**
1. Go to **Domains** tab
2. Verify SSL status
3. Regenerate if needed

### High Resource Usage

**Optimize Docker image:**
- Use multi-stage builds
- Remove unnecessary dependencies
- Use alpine base images

**Scale resources:**
- Upgrade VPS plan
- Add more servers

### Logs Not Showing

**Ensure application logs to stdout:**

```javascript
// Use console.log for logging
console.log('Application started');
console.error('Error occurred:', error);
```

---

## Security Best Practices

1. **Firewall Configuration**
   ```bash
   # Allow only necessary ports
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```

2. **Regular Updates**
   ```bash
   # Update Dokploy
   curl -sSL https://dokploy.com/install.sh | sh
   
   # Update system packages
   apt update && apt upgrade -y
   ```

3. **Environment Variables**
   - Never commit `.env` files
   - Use Dokploy's environment variable management
   - Rotate secrets regularly

4. **SSL Certificates**
   - Automatic renewal via Let's Encrypt
   - Monitor expiration dates
   - Use HTTPS everywhere

---

## Cost Estimation

### VPS Hosting

| Provider | Plan | Specs | Cost/Month |
|----------|------|-------|------------|
| Hetzner | CX21 | 2 vCPU, 4GB RAM | ~$5 |
| DigitalOcean | Basic | 2 vCPU, 4GB RAM | ~$24 |
| Vultr | Regular | 2 vCPU, 4GB RAM | ~$18 |

### Additional Costs

- **Domain:** $10-15/year
- **Supabase:** Free tier or $25/month (Pro)
- **AWS S3:** ~$5-20/month (depending on usage)
- **Gumroad:** 10% transaction fee

**Total Estimated Monthly Cost:** $10-50 (excluding Gumroad fees)

---

## Comparison: Dokploy vs Vercel/Netlify

| Feature | Dokploy | Vercel/Netlify |
|---------|---------|----------------|
| **Cost** | VPS cost only (~$5-25/mo) | Free tier, then $20+/mo per member |
| **Control** | Full server access | Limited |
| **Customization** | Complete | Limited to platform features |
| **Databases** | Self-hosted included | Extra cost |
| **Build Minutes** | Unlimited | Limited on free tier |
| **Bandwidth** | VPS limits | Limited on free tier |
| **Learning Curve** | Moderate | Easy |

---

## Next Steps

1. ✅ Set up VPS server
2. ✅ Install Dokploy
3. ✅ Configure domain and SSL
4. ✅ Create Dockerfile
5. ✅ Deploy application
6. ✅ Set up automatic deployments
7. ✅ Configure monitoring and alerts
8. ✅ Test all features in production

Your Roost is now deployed and ready for users! 🚀
