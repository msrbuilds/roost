# Docker & Dockploy Guides

This guide was split into two focused VPS guides:

- [Docker (VPS)](./docker-vps.md)
- [Dockploy (VPS)](./dockploy-vps.md)

<<<<<<< HEAD
Use Docker guide for direct VPS deployment.
Use Dockploy guide for Dockploy-managed deployment.
=======
## Prerequisites

- A VPS/server (Ubuntu 22.04+ recommended, minimum 2GB RAM)
- A domain name pointed to your server's IP
- Docker and Docker Compose installed
- Your database configured (Supabase Cloud, Self-hosted, or MongoDB)

---

## Step 1: Prepare Your Server

### Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## Step 2: Clone and Configure

```bash
# Clone the project
git clone https://github.com/msrbuilds/roost.git
cd roost

# Run the installer
bash install.sh
# Select "Docker / Dokploy" as deployment target
# Fill in all configuration values
```

Or configure manually:

```bash
cp .env.example .env.local
cp server/.env.example server/.env
# Edit both files with production values
```

---

## Step 3: Configure docker-compose.yml

Edit `docker-compose.yml` to set your domain:

```yaml
services:
  frontend:
    labels:
      # Replace with YOUR domain
      - "traefik.http.routers.frontend.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"

  backend:
    labels:
      # Same domain, /api path
      - "traefik.http.routers.backend.rule=Host(`your-domain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
```

### Environment Variables

Set production values in your shell or `.env` file:

```bash
# Create a .env file for docker-compose
cat > .env << 'EOF'
# Frontend build args
VITE_DB_PROVIDER=supabase-cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-bucket
VITE_APP_NAME=Your Community
VITE_APP_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com

# Backend env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=Your Community
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
EOF
```

---

## Step 4: Build and Deploy

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f frontend
docker compose logs -f backend
```

Expected output:
```
NAME                STATUS          PORTS
roost-frontend    Up (healthy)    0.0.0.0:80->80/tcp
roost-backend     Up (healthy)    0.0.0.0:3000->3000/tcp
```

---

## Step 5: Set Up SSL with Traefik (Optional)

If not using Dokploy, set up Traefik for automatic SSL:

```bash
# Create a docker network for Traefik
docker network create traefik-public

# Create Traefik docker-compose
cat > traefik-compose.yml << 'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@domain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-letsencrypt:/letsencrypt
    networks:
      - traefik-public

volumes:
  traefik-letsencrypt:

networks:
  traefik-public:
    external: true
EOF

docker compose -f traefik-compose.yml up -d
```

---

## Step 6: Verify Deployment

```bash
# Health check
curl https://your-domain.com/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}

# Check frontend
curl -I https://your-domain.com
# Should return 200 OK
```

---

## Dokploy Setup (Automated Deployments)

[Dokploy](https://dokploy.com) is a self-hosted PaaS that provides automatic deployments from Git.

### Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Access Dokploy at `http://your-server-ip:3000` (it moves to port 3000 by default).

### Configure in Dokploy

1. **Create Application**
   - Go to Dokploy dashboard
   - Click **Create** > **Application**
   - Choose **Docker Compose**

2. **Connect Repository**
   - Link your GitHub/GitLab repository
   - Set the branch to deploy (e.g., `main`)

3. **Environment Variables**
   - Go to **Environment** tab
   - Add all the environment variables from the `.env` file above

4. **Domain**
   - Go to **Domains** tab
   - Add `your-domain.com`
   - Dokploy handles SSL automatically via Traefik

5. **Deploy**
   - Click **Deploy**
   - Dokploy builds and starts your containers

### Auto-Deploy on Push

1. In Dokploy, go to **Settings** > **Webhooks**
2. Copy the webhook URL
3. In your GitHub repo, go to **Settings** > **Webhooks** > **Add webhook**
4. Paste the URL and select **push** events
5. Now every push to `main` triggers a deployment

---

## Updating

### Manual Update

```bash
cd roost
git pull
docker compose up -d --build
```

### Zero-Downtime Update

```bash
# Build new image
docker compose build

# Rolling restart
docker compose up -d --no-deps --build frontend
docker compose up -d --no-deps --build backend
```

---

## Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail 100 backend
```

### Resource Usage

```bash
docker stats
```

### Health Checks

The backend has a built-in health check at `/api/health`. Docker monitors it automatically:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## Backup Strategy

### Database Backup (Supabase)

```bash
# Trigger backup via API
curl -X POST https://your-domain.com/api/backup/trigger \
  -H "Authorization: Bearer YOUR_BACKUP_TOKEN"
```

### Database Backup (MongoDB)

```bash
# From inside the container
docker exec roost-mongo mongodump --db roost --out /backups/$(date +%Y%m%d)

# Or from host
mongodump --host localhost --port 27017 --db roost --out ./backups/
```

### Full Application Backup

```bash
# Backup docker volumes
docker run --rm -v roost-mongo-data:/data -v $(pwd)/backups:/backup ubuntu tar czf /backup/mongo-data.tar.gz -C /data .
```

---

## Troubleshooting

### Container won't start
```bash
docker compose logs frontend
docker compose logs backend
# Look for missing env vars or build errors
```

### Port already in use
```bash
# Check what's using port 80
sudo lsof -i :80
# Stop the conflicting service or change ports in docker-compose.yml
```

### Out of disk space
```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

### SSL certificate not working
- Verify DNS A record points to your server IP
- Check Traefik logs: `docker logs traefik`
- Wait a few minutes for Let's Encrypt propagation

---

## Next Steps

- [Configure Email Notifications](./email-setup.md)
- [Set up Gumroad Integration](./gumroad-setup.md)
>>>>>>> b766254403487808456d8e022343faa6ba93fe7e
