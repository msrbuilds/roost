#!/usr/bin/env bash
# ============================================================
# Roost - Community Platform Installer
# Interactive setup script for self-hosted deployment
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Defaults
APP_PORT=5173
API_PORT=3000
VPS_BOOTSTRAP=false
DOKPLOY_POSTGRES_PASSWORD=""
DOKPLOY_SECRET_KEY_BASE=""
LETSENCRYPT_EMAIL=""

# --- Helper Functions ---
print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ██████╗  ██████╗  ██████╗ ███████╗████████╗"
  echo "  ██╔══██╗██╔═══██╗██╔═══██╗██╔════╝╚══██╔══╝"
  echo "  ██████╔╝██║   ██║██║   ██║███████╗   ██║   "
  echo "  ██╔══██╗██║   ██║██║   ██║╚════██║   ██║   "
  echo "  ██║  ██║╚██████╔╝╚██████╔╝███████║   ██║   "
  echo "  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚═╝   "
  echo -e "${NC}"
  echo -e "${BOLD}  Community Platform Installer${NC}"
  echo -e "  ─────────────────────────────────"
  echo ""
}

print_step() {
  echo -e "\n${BLUE}${BOLD}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
  echo -e "${BLUE}─────────────────────────────────${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}!${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

ask() {
  local prompt="$1"
  local default="$2"
  local var_name="$3"

  if [ -n "$default" ]; then
    echo -ne "${CYAN}?${NC} ${prompt} ${YELLOW}[${default}]${NC}: "
  else
    echo -ne "${CYAN}?${NC} ${prompt}: "
  fi

  read -r input
  if [ -z "$input" ] && [ -n "$default" ]; then
    eval "$var_name='$default'"
  else
    eval "$var_name='$input'"
  fi
}

ask_secret() {
  local prompt="$1"
  local var_name="$2"

  echo -ne "${CYAN}?${NC} ${prompt}: "
  read -rs input
  echo ""
  eval "$var_name='$input'"
}

ask_choice() {
  local prompt="$1"
  shift
  local options=("$@")
  local choice=""
  local min=1
  local max=${#options[@]}

  echo -e "${CYAN}?${NC} ${prompt}"
  for i in "${!options[@]}"; do
    echo -e "  ${BOLD}$((i+1)))${NC} ${options[$i]}"
  done

  while true; do
    echo -ne "${CYAN}   Enter choice [${min}-${max}]${NC}: "
    read -r choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge "$min" ] && [ "$choice" -le "$max" ]; then
      CHOICE_RESULT=$((choice - 1))
      return 0
    fi
    print_warning "Invalid choice. Please enter a number between ${min} and ${max}."
  done
}

generate_secret() {
  openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 2>/dev/null || echo "change-me-$(date +%s)-$(shuf -i 1000-9999 -n 1)"
}

b64url_encode() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

generate_hs256_jwt() {
  local role="$1"
  local secret="$2"
  local now exp header payload encoded_header encoded_payload signature

  if ! command -v openssl >/dev/null 2>&1; then
    print_error "openssl is required to generate Supabase JWT keys."
    exit 1
  fi

  now=$(date +%s)
  exp=$((now + 315360000)) # 10 years
  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"role\":\"${role}\",\"iss\":\"supabase\",\"iat\":${now},\"exp\":${exp}}"

  encoded_header=$(printf '%s' "$header" | b64url_encode)
  encoded_payload=$(printf '%s' "$payload" | b64url_encode)
  signature=$(printf '%s' "${encoded_header}.${encoded_payload}" | openssl dgst -sha256 -hmac "$secret" -binary | b64url_encode)

  printf '%s.%s.%s' "$encoded_header" "$encoded_payload" "$signature"
}

is_apt_based() {
  command -v apt-get >/dev/null 2>&1
}

run_with_sudo() {
  if [ "$EUID" -eq 0 ]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    print_error "sudo is required to install system packages. Re-run as root or install sudo."
    exit 1
  fi
}

install_vps_base_packages() {
  if ! is_apt_based; then
    print_warning "Auto-install is currently supported for Ubuntu/Debian only."
    return
  fi

  print_success "Updating apt package index..."
  run_with_sudo apt-get update

  print_success "Installing base system packages..."
  run_with_sudo apt-get install -y ca-certificates curl gnupg lsb-release git openssl
}

install_nodejs_20() {
  local node_major=""
  if command -v node >/dev/null 2>&1; then
    node_major=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_major" -ge 20 ]; then
      print_success "Node.js $(node -v) already installed"
      return
    fi
  fi

  if ! is_apt_based; then
    print_error "Node.js 20+ is required. Install it manually on this OS."
    exit 1
  fi

  print_success "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | run_with_sudo bash -
  run_with_sudo apt-get install -y nodejs
}

install_docker_runtime() {
  if ! is_apt_based; then
    print_error "Docker auto-install is currently supported for Ubuntu/Debian only."
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    print_success "Installing Docker Engine..."
    curl -fsSL https://get.docker.com | run_with_sudo sh
  else
    print_success "Docker already installed"
  fi

  print_success "Installing Docker Compose plugin..."
  run_with_sudo apt-get install -y docker-compose-plugin

  run_with_sudo systemctl enable --now docker >/dev/null 2>&1 || true

  # Add current user to docker group (takes effect after new login)
  local target_user="${SUDO_USER:-$USER}"
  if [ -n "$target_user" ]; then
    run_with_sudo usermod -aG docker "$target_user" >/dev/null 2>&1 || true
  fi
}

# --- Pre-flight Checks ---
check_dependencies() {
  local missing=()
  local node_major=""

  command -v node >/dev/null 2>&1 || missing+=("node")
  command -v npm >/dev/null 2>&1 || missing+=("npm")
  command -v git >/dev/null 2>&1 || missing+=("git")

  if [ ${#missing[@]} -gt 0 ]; then
    print_error "Missing required dependencies: ${missing[*]}"
    echo "  Install them and run this script again."
    exit 1
  fi

  node_major=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_major" -lt 20 ]; then
    print_error "Node.js 20+ required (found $(node -v))"
    exit 1
  fi

  print_success "Node.js $(node -v) detected"
  print_success "npm $(npm -v) detected"
  print_success "git detected"
}

ensure_docker_runtime() {
  local docker_ok=true

  if ! command -v docker >/dev/null 2>&1; then
    docker_ok=false
  fi

  if ! docker compose version >/dev/null 2>&1; then
    docker_ok=false
  fi

  if [ "$docker_ok" = true ]; then
    print_success "Docker and Docker Compose detected"
    return
  fi

  print_warning "Docker and Docker Compose are required for this deployment target."

  if ! is_apt_based; then
    print_error "Auto-install unavailable on this OS. Install Docker manually and re-run."
    exit 1
  fi

  ask_choice "Install Docker + Docker Compose now?" \
    "Yes (recommended)" \
    "No, I'll install them manually"

  if [ "$CHOICE_RESULT" = "0" ]; then
    install_docker_runtime
  else
    print_error "Cannot continue without Docker."
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    print_error "Docker installation did not complete successfully."
    exit 1
  fi
}

generate_compose_env() {
  local backup_token compose_profiles=""
  backup_token=$(generate_secret | tr -d '\n')

  if [ "$DB_PROVIDER" = "mongodb" ]; then
    compose_profiles="mongodb"
  fi

  if [ -n "${REDIS_URL:-}" ] && [ "${REDIS_URL}" = "redis://redis:6379" ]; then
    if [ -n "$compose_profiles" ]; then
      compose_profiles="${compose_profiles},redis"
    else
      compose_profiles="redis"
    fi
  fi

  cat > .env << ENVEOF
# ============================================================
# Roost - Docker Compose Environment
# Generated by install.sh on $(date)
# ============================================================

# Domain / Routing
ROOST_DOMAIN=${APP_DOMAIN}
BACKUP_API_URL=${APP_URL}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
COMPOSE_PROFILES=${compose_profiles}

# Frontend build args
VITE_DB_PROVIDER=${DB_PROVIDER}
VITE_DATABASE_URL=${MONGODB_URL:-}
VITE_SUPABASE_URL=${SUPABASE_URL:-}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY:-}
VITE_AWS_REGION=${AWS_REGION}
VITE_AWS_S3_BUCKET=${AWS_S3_BUCKET}
VITE_APP_NAME="${COMMUNITY_NAME}"
VITE_APP_URL=${APP_URL}
VITE_API_URL=${APP_URL}
VITE_STRIPE_ENABLED=${STRIPE_ENABLED}

# Backend runtime
DB_PROVIDER=${DB_PROVIDER}
DATABASE_URL=${MONGODB_URL:-}
JWT_SECRET=${JWT_SECRET:-$(generate_secret)}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_SECRET_KEY=${SUPABASE_SERVICE_KEY:-}
FRONTEND_URL=${APP_URL}
ALLOWED_ORIGINS=${APP_URL}

# Email
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-}
SMTP_FROM_NAME="${SMTP_FROM_NAME:-${COMMUNITY_NAME}}"

# Storage
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
S3_ENDPOINT=${S3_ENDPOINT:-}

# Redis
REDIS_URL=${REDIS_URL:-}

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
STRIPE_PRICE_ID=${STRIPE_PRICE_ID:-}

# Backup
BACKUP_SECRET_TOKEN=${backup_token}
AWS_BACKUP_BUCKET=${AWS_BACKUP_BUCKET:-}
AWS_BACKUP_REGION=${AWS_BACKUP_REGION:-${AWS_REGION}}
AWS_BACKUP_ACCESS_KEY_ID=${AWS_BACKUP_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}
AWS_BACKUP_SECRET_ACCESS_KEY=${AWS_BACKUP_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}
SUPABASE_DB_PASSWORD=${SUPABASE_DB_PASSWORD:-}
SUPABASE_DB_HOST=${SUPABASE_DB_HOST:-}
SUPABASE_DB_PORT=${SUPABASE_DB_PORT:-5432}
SUPABASE_DB_USER=${SUPABASE_DB_USER:-postgres}
ENVEOF

  print_success "Created .env for Docker Compose"
}

generate_dokploy_env() {
  local postgres_password secret_key_base jwt_secret anon_key service_role_key

  jwt_secret="${JWT_SECRET:-$(generate_secret | tr -d '\n')}"
  anon_key="${SUPABASE_ANON_KEY:-$(generate_hs256_jwt "anon" "$jwt_secret")}"
  service_role_key="${SUPABASE_SERVICE_KEY:-$(generate_hs256_jwt "service_role" "$jwt_secret")}"
  postgres_password="${DOKPLOY_POSTGRES_PASSWORD:-$(generate_secret | tr -d '\n')}"
  secret_key_base="${DOKPLOY_SECRET_KEY_BASE:-$(generate_secret | tr -d '\n')}"

  JWT_SECRET="$jwt_secret"
  SUPABASE_ANON_KEY="$anon_key"
  SUPABASE_SERVICE_KEY="$service_role_key"
  DOKPLOY_POSTGRES_PASSWORD="$postgres_password"
  DOKPLOY_SECRET_KEY_BASE="$secret_key_base"

  if [ "$APP_DOMAIN" = "localhost" ]; then
    SUPABASE_URL="http://localhost"
  else
    SUPABASE_URL="https://${APP_DOMAIN}"
  fi

  cat > .env.dokploy << ENVEOF
# ============================================================
# Roost - Dokploy Environment
# Generated by install.sh on $(date)
# ============================================================

# Core
ROOST_DOMAIN=${APP_DOMAIN}
APP_NAME="${COMMUNITY_NAME}"

# Supabase self-hosted core keys
POSTGRES_PASSWORD=${postgres_password}
JWT_SECRET=${jwt_secret}
ANON_KEY=${anon_key}
SERVICE_ROLE_KEY=${service_role_key}
SECRET_KEY_BASE=${secret_key_base}

# Roost optional integrations
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-}
STRIPE_ENABLED=${STRIPE_ENABLED}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
STRIPE_PRICE_ID=${STRIPE_PRICE_ID:-}
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
ENVEOF

  print_success "Created .env.dokploy for docker-compose.dokploy.yml / Dokploy"
}

# ============================================================
# MAIN INSTALLER
# ============================================================
TOTAL_STEPS=7

print_banner

echo -e "${BOLD}Welcome to the Roost installer!${NC}"
echo "This script configures app env files and can bootstrap a VPS."
echo ""

# --- Step 1: System Prep ---
print_step 1 "System preparation and dependency checks"

ask_choice "Is this a fresh Ubuntu/Debian VPS where the installer should auto-install packages?" \
  "Yes (install/update Node.js, Git, Docker, Docker Compose)" \
  "No (dependencies are already installed)"

if [ "$CHOICE_RESULT" = "0" ]; then
  VPS_BOOTSTRAP=true
  install_vps_base_packages
  install_nodejs_20
fi

check_dependencies

# --- Step 2: Basic Configuration ---
print_step 2 "Basic configuration"

ask "Community name" "Roost" COMMUNITY_NAME
ask "Community tagline" "Learn, Build, Grow Together" COMMUNITY_TAGLINE
ask "Your domain (or localhost for dev)" "localhost" APP_DOMAIN

if [ "$APP_DOMAIN" = "localhost" ]; then
  APP_URL="http://localhost:${APP_PORT}"
  API_URL="http://localhost:${API_PORT}"
  IS_PRODUCTION=false
else
  APP_URL="https://${APP_DOMAIN}"
  API_URL="https://${APP_DOMAIN}"
  IS_PRODUCTION=true
fi

print_success "App URL: ${APP_URL}"
print_success "API URL: ${API_URL}"

# --- Step 3: Database Provider ---
print_step 3 "Database provider"

ask_choice "Select your database provider:" \
  "Supabase Cloud (Recommended - easiest setup)" \
  "Supabase Self-hosted (Community Edition)" \
  "MongoDB (Local/Atlas with Prisma)"

DB_PROVIDER_IDX=$CHOICE_RESULT
case $DB_PROVIDER_IDX in
  0) DB_PROVIDER="supabase-cloud" ;;
  1) DB_PROVIDER="supabase-selfhosted" ;;
  2) DB_PROVIDER="mongodb" ;;
  *) DB_PROVIDER="supabase-cloud" ;;
esac

print_success "Database: ${DB_PROVIDER}"

# Collect DB-specific config
case $DB_PROVIDER in
  supabase-cloud)
    echo ""
    echo -e "${YELLOW}  Get credentials from: https://supabase.com/dashboard${NC}"
    echo ""
    ask "Supabase Project URL" "" SUPABASE_URL
    ask_secret "Supabase Anon/Public Key" SUPABASE_ANON_KEY
    ask_secret "Supabase Service Role Key (for server)" SUPABASE_SERVICE_KEY
    ;;
  supabase-selfhosted)
    echo ""
    echo -e "${YELLOW}  Enter your self-hosted Supabase instance details${NC}"
    echo ""
    ask "Supabase URL" "http://localhost:8000" SUPABASE_URL
    ask_secret "Supabase Anon/Public Key" SUPABASE_ANON_KEY
    ask_secret "Supabase Service Role Key" SUPABASE_SERVICE_KEY
    ;;
  mongodb)
    echo ""
    echo -e "${YELLOW}  MongoDB can be local, Docker, or MongoDB Atlas${NC}"
    echo ""
    ask "MongoDB Connection URL" "mongodb://localhost:27017/roost" MONGODB_URL
    JWT_SECRET=$(generate_secret)
    print_success "JWT secret generated automatically"
    ;;
esac

# --- Step 4: Deployment Target ---
print_step 4 "Deployment target"

ask_choice "Where will you deploy?" \
  "Docker (Self-hosted VPS)" \
  "Dockploy (Self-hosted VPS)" \
  "Vercel (Frontend) + Separate Backend" \
  "Netlify (Frontend) + Separate Backend" \
  "Local Development Only"

DEPLOY_TARGET_IDX=$CHOICE_RESULT
case $DEPLOY_TARGET_IDX in
  0) DEPLOY_TARGET="docker" ;;
  1) DEPLOY_TARGET="dockploy" ;;
  2) DEPLOY_TARGET="vercel" ;;
  3) DEPLOY_TARGET="netlify" ;;
  4) DEPLOY_TARGET="local" ;;
  *) DEPLOY_TARGET="local" ;;
esac

print_success "Deploy target: ${DEPLOY_TARGET}"

if [ "$DEPLOY_TARGET" = "docker" ] || [ "$DEPLOY_TARGET" = "dockploy" ]; then
  if [ "$VPS_BOOTSTRAP" = true ]; then
    install_docker_runtime
  fi
  ensure_docker_runtime
fi

if [ "$DEPLOY_TARGET" = "docker" ] && [ "$APP_DOMAIN" = "localhost" ]; then
  print_warning "Docker VPS deployment requires a real domain for automatic Let's Encrypt SSL."
  while [ "$APP_DOMAIN" = "localhost" ]; do
    ask "Enter your production domain for Docker VPS" "" APP_DOMAIN
    if [ -z "$APP_DOMAIN" ] || [ "$APP_DOMAIN" = "localhost" ]; then
      print_warning "Please enter a valid domain (example: community.example.com)."
      APP_DOMAIN="localhost"
    fi
  done
  APP_URL="https://${APP_DOMAIN}"
  API_URL="https://${APP_DOMAIN}"
  IS_PRODUCTION=true
  print_success "Updated App URL: ${APP_URL}"
  print_success "Updated API URL: ${API_URL}"
fi

if [ "$DEPLOY_TARGET" = "docker" ]; then
  while true; do
    ask "Let's Encrypt email (required for SSL certificates)" "" LETSENCRYPT_EMAIL
    if [ -n "$LETSENCRYPT_EMAIL" ]; then
      break
    fi
    print_warning "Let's Encrypt email is required for Docker VPS deployment."
  done
fi

if [ "$DEPLOY_TARGET" = "dockploy" ] && [ "$DB_PROVIDER" != "supabase-selfhosted" ]; then
  print_warning "Dockploy stack is Supabase self-hosted by design. Switching DB provider to supabase-selfhosted."
  DB_PROVIDER="supabase-selfhosted"
fi

if [ "$DEPLOY_TARGET" = "dockploy" ]; then
  JWT_SECRET="${JWT_SECRET:-$(generate_secret | tr -d '\n')}"
  SUPABASE_ANON_KEY="$(generate_hs256_jwt "anon" "$JWT_SECRET")"
  SUPABASE_SERVICE_KEY="$(generate_hs256_jwt "service_role" "$JWT_SECRET")"
  DOKPLOY_POSTGRES_PASSWORD="${DOKPLOY_POSTGRES_PASSWORD:-$(generate_secret | tr -d '\n')}"
  DOKPLOY_SECRET_KEY_BASE="${DOKPLOY_SECRET_KEY_BASE:-$(generate_secret | tr -d '\n')}"

  if [ "$APP_DOMAIN" = "localhost" ]; then
    SUPABASE_URL="http://localhost"
  else
    SUPABASE_URL="https://${APP_DOMAIN}"
  fi
fi

# --- Step 5: Optional Services ---
print_step 5 "Optional services"

# S3 / Storage
echo ""
ask_choice "File storage provider:" \
  "AWS S3" \
  "S3-Compatible (MinIO, Cloudflare R2, etc.)" \
  "Local filesystem (dev only)"

STORAGE_IDX=$CHOICE_RESULT
case $STORAGE_IDX in
  0|1)
    ask "S3 Region" "us-east-1" AWS_REGION
    ask "S3 Bucket Name" "roost-uploads" AWS_S3_BUCKET
    ask_secret "AWS Access Key ID" AWS_ACCESS_KEY_ID
    ask_secret "AWS Secret Access Key" AWS_SECRET_ACCESS_KEY
    if [ "$STORAGE_IDX" = "1" ]; then
      ask "S3 Endpoint URL" "" S3_ENDPOINT
    fi
    ;;
  2)
    AWS_REGION="local"
    AWS_S3_BUCKET="local"
    AWS_ACCESS_KEY_ID=""
    AWS_SECRET_ACCESS_KEY=""
    print_warning "Local storage selected: uploads saved to ./uploads/"
    ;;
esac

# SMTP
echo ""
ask_choice "Configure email (SMTP) for notifications?" \
  "Yes" \
  "No, skip for now"
if [ "$CHOICE_RESULT" = "0" ]; then
  ask "SMTP Host" "smtp.gmail.com" SMTP_HOST
  ask "SMTP Port" "587" SMTP_PORT
  ask "SMTP Username" "" SMTP_USER
  ask_secret "SMTP Password" SMTP_PASS
  ask "From Email" "" SMTP_FROM_EMAIL
  SMTP_FROM_NAME="$COMMUNITY_NAME"
else
  SMTP_HOST=""
  SMTP_PORT=""
  SMTP_USER=""
  SMTP_PASS=""
  SMTP_FROM_EMAIL=""
  SMTP_FROM_NAME=""
fi

# Redis
echo ""
ask_choice "Configure Redis for caching & rate limiting?" \
  "Yes" \
  "No, use in-memory (fine for small communities)"
if [ "$CHOICE_RESULT" = "0" ]; then
  DEFAULT_REDIS_URL="redis://localhost:6379"
  if [ "$DEPLOY_TARGET" = "docker" ]; then
    DEFAULT_REDIS_URL="redis://redis:6379"
  fi
  ask "Redis URL" "$DEFAULT_REDIS_URL" REDIS_URL
else
  REDIS_URL=""
fi

# Stripe
echo ""
ask_choice "Enable Stripe integration (paid memberships)?" \
  "Yes" \
  "No"
if [ "$CHOICE_RESULT" = "0" ]; then
  STRIPE_ENABLED="true"
  ask_secret "Stripe Secret Key (sk_...)" STRIPE_SECRET_KEY
  ask_secret "Stripe Webhook Secret (whsec_...)" STRIPE_WEBHOOK_SECRET
  ask "Stripe Price ID (price_...)" "" STRIPE_PRICE_ID
else
  STRIPE_ENABLED="false"
  STRIPE_SECRET_KEY=""
  STRIPE_WEBHOOK_SECRET=""
  STRIPE_PRICE_ID=""
fi

# Docker-target defaults for local MongoDB profile
if [ "$DEPLOY_TARGET" = "docker" ] && [ "$DB_PROVIDER" = "mongodb" ] && [ "${MONGODB_URL:-}" = "mongodb://localhost:27017/roost" ]; then
  MONGODB_URL="mongodb://mongo:27017/roost"
  print_success "Using Docker MongoDB profile URL: ${MONGODB_URL}"
fi

# --- Step 6: Generate Configuration Files ---
print_step 6 "Generating configuration files"

# Frontend .env
cat > .env.local << ENVEOF
# ============================================================
# Roost - Frontend Configuration
# Generated by install.sh on $(date)
# ============================================================

# App
VITE_APP_NAME="${COMMUNITY_NAME}"
VITE_APP_TAGLINE="${COMMUNITY_TAGLINE}"
VITE_APP_URL=${APP_URL}
VITE_API_URL=${API_URL}

# Database Provider: supabase-cloud | supabase-selfhosted | mongodb
VITE_DB_PROVIDER=${DB_PROVIDER}

# Supabase (if using supabase-cloud or supabase-selfhosted)
VITE_SUPABASE_URL=${SUPABASE_URL:-}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY:-}

# MongoDB (if using mongodb)
VITE_DATABASE_URL=${MONGODB_URL:-}

# AWS S3 / Storage
VITE_AWS_REGION=${AWS_REGION}
VITE_AWS_S3_BUCKET=${AWS_S3_BUCKET}

# Features
VITE_ENABLE_SIGNUP=true
VITE_STRIPE_ENABLED=${STRIPE_ENABLED}
VITE_ENABLE_SHOWCASE=true
VITE_ENABLE_LIVE_ROOM=true
VITE_ENABLE_LEADERBOARD=true

# Debug
VITE_DEBUG_MODE=false
VITE_ENABLE_MOCK_DATA=false
ENVEOF

print_success "Created .env.local"

# Backend .env
cat > server/.env << ENVEOF
# ============================================================
# Roost - Backend Configuration
# Generated by install.sh on $(date)
# ============================================================

NODE_ENV=$([ "$IS_PRODUCTION" = true ] && echo "production" || echo "development")
PORT=${API_PORT}

# Database Provider
DB_PROVIDER=${DB_PROVIDER}

# Supabase (if using supabase-cloud or supabase-selfhosted)
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_SECRET_KEY=${SUPABASE_SERVICE_KEY:-}

# MongoDB (if using mongodb)
DATABASE_URL=${MONGODB_URL:-}
JWT_SECRET=${JWT_SECRET:-$(generate_secret)}

# AWS S3 / Storage
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
${S3_ENDPOINT:+S3_ENDPOINT=${S3_ENDPOINT}}

# Email (SMTP)
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-}
SMTP_FROM_NAME="${SMTP_FROM_NAME:-${COMMUNITY_NAME}}"

# Redis
REDIS_URL=${REDIS_URL:-}

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
STRIPE_PRICE_ID=${STRIPE_PRICE_ID:-}

# CORS
ALLOWED_ORIGINS=${APP_URL}
FRONTEND_URL=${APP_URL}
ENVEOF

print_success "Created server/.env"

# --- Generate deployment-specific files ---
case $DEPLOY_TARGET in
  vercel)
    cat > vercel.json << 'VERCELEOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
VERCELEOF
    print_success "Created vercel.json"
    ;;

  netlify)
    cat > netlify.toml << 'NETLIFYEOF'
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
NETLIFYEOF
    print_success "Created netlify.toml"
    ;;

  docker)
    generate_compose_env
    ;;

  dockploy)
    generate_dokploy_env
    ;;
esac

# --- Step 7: Install Dependencies ---
print_step 7 "Installing dependencies"

ask_choice "Install npm dependencies now?" \
  "Yes" \
  "No, I'll do it later"

if [ "$CHOICE_RESULT" = "0" ]; then
  echo "Installing frontend dependencies..."
  npm install

  # Add Prisma deps if MongoDB selected
  if [ "$DB_PROVIDER" = "mongodb" ]; then
    echo "Installing Prisma..."
    npm install prisma @prisma/client
    npx prisma generate
  fi

  echo "Installing backend dependencies..."
  cd server && npm install && cd ..

  # Add MongoDB auth deps if MongoDB
  if [ "$DB_PROVIDER" = "mongodb" ]; then
    cd server
    npm install @prisma/client jsonwebtoken bcryptjs
    npm install -D @types/jsonwebtoken @types/bcryptjs
    cd ..
  fi

  print_success "All dependencies installed"
else
  echo ""
  echo -e "${YELLOW}Run these commands when ready:${NC}"
  echo "  npm install"
  [ "$DB_PROVIDER" = "mongodb" ] && echo "  npm install prisma @prisma/client && npx prisma generate"
  echo "  cd server && npm install"
  [ "$DB_PROVIDER" = "mongodb" ] && echo "  cd server && npm install @prisma/client jsonwebtoken bcryptjs"
fi

# --- Database Setup ---
if [ "$DEPLOY_TARGET" = "dockploy" ]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Database Setup (Dockploy):${NC}"
  echo "  Supabase self-hosted services are included in docker-compose.dokploy.yml."
  echo "  Use the generated .env.dokploy values in Dokploy or for manual compose deploy."
elif [ "$DB_PROVIDER" = "supabase-cloud" ] || [ "$DB_PROVIDER" = "supabase-selfhosted" ]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Database Setup (Supabase):${NC}"
  echo "  Run schema.sql in your Supabase SQL Editor, then create your first admin."
  echo "  Or use Supabase CLI: supabase db push"
elif [ "$DB_PROVIDER" = "mongodb" ]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Database Setup (MongoDB):${NC}"
  echo "  Run Prisma migrations:"
  echo "  npx prisma db push"
fi

# --- Final Summary ---
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Installation Complete!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Community:${NC}    ${COMMUNITY_NAME}"
echo -e "  ${BOLD}Database:${NC}     ${DB_PROVIDER}"
echo -e "  ${BOLD}Deploy:${NC}       ${DEPLOY_TARGET}"
echo -e "  ${BOLD}URL:${NC}          ${APP_URL}"
echo ""
echo -e "${BOLD}Quick Start:${NC}"
echo ""

case $DEPLOY_TARGET in
  local)
    echo "  # Start frontend"
    echo "  npm run dev"
    echo ""
    echo "  # Start backend (new terminal)"
    echo "  cd server && npm run dev"
    ;;
  docker)
    echo "  # Build and run (reads generated .env)"
    echo "  docker compose up -d --build"
    ;;
  dockploy)
    echo "  # Manual compose (optional, outside Dokploy UI)"
    echo "  cp .env.dokploy .env"
    echo "  docker compose -f docker-compose.dokploy.yml up -d --build"
    ;;
  vercel)
    echo "  # Deploy frontend to Vercel"
    echo "  vercel deploy"
    echo ""
    echo "  # Deploy backend separately (e.g., VPS/Railway/Render)"
    echo "  cd server && npm run build && npm start"
    ;;
  netlify)
    echo "  # Deploy frontend to Netlify"
    echo "  netlify deploy --prod"
    echo ""
    echo "  # Deploy backend separately"
    echo "  cd server && npm run build && npm start"
    ;;
esac

echo ""
echo -e "${YELLOW}${BOLD}Docs:${NC}"
echo "  - Docker VPS: guides/docker-vps.md"
echo "  - Dockploy VPS: guides/dockploy-vps.md"
echo "  - Netlify: guides/netlify.md"
echo "  - Vercel: guides/vercel.md"
echo ""
