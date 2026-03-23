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
APP_NAME="Roost"
APP_PORT=5173
API_PORT=3000

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

  echo -e "${CYAN}?${NC} ${prompt}"
  for i in "${!options[@]}"; do
    echo -e "  ${BOLD}$((i+1)))${NC} ${options[$i]}"
  done
  echo -ne "${CYAN}   Enter choice [1-${#options[@]}]${NC}: "
  read -r choice
  CHOICE_RESULT=$((choice - 1))
}

generate_secret() {
  openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 2>/dev/null || echo "change-me-$(date +%s)-$(shuf -i 1000-9999 -n 1)"
}

# --- Pre-flight Checks ---
check_dependencies() {
  local missing=()

  command -v node >/dev/null 2>&1 || missing+=("node")
  command -v npm >/dev/null 2>&1 || missing+=("npm")
  command -v git >/dev/null 2>&1 || missing+=("git")

  if [ ${#missing[@]} -gt 0 ]; then
    print_error "Missing required dependencies: ${missing[*]}"
    echo "  Please install them and run this script again."
    exit 1
  fi

  # Check Node version
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ required (found v$(node -v))"
    exit 1
  fi

  print_success "Node.js $(node -v) detected"
  print_success "npm $(npm -v) detected"
}

# ============================================================
# MAIN INSTALLER
# ============================================================
TOTAL_STEPS=7

print_banner

echo -e "${BOLD}Welcome to the Roost installer!${NC}"
echo "This script will configure your community platform."
echo ""

# --- Step 1: Pre-flight ---
print_step 1 "Checking dependencies"
check_dependencies

# --- Step 2: Basic Configuration ---
print_step 2 "Basic Configuration"

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
print_step 3 "Database Provider"

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
    echo -e "${YELLOW}  Get your credentials from: https://supabase.com/dashboard${NC}"
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
    echo -e "${YELLOW}  MongoDB can be local or MongoDB Atlas (cloud)${NC}"
    echo ""
    ask "MongoDB Connection URL" "mongodb://localhost:27017/roost" MONGODB_URL
    JWT_SECRET=$(generate_secret)
    print_success "JWT secret generated automatically"
    ;;
esac

# --- Step 4: Deployment Target ---
print_step 4 "Deployment Target"

ask_choice "Where will you deploy?" \
  "Docker / Dokploy (Self-hosted VPS)" \
  "Vercel (Frontend) + Separate Backend" \
  "Netlify (Frontend) + Separate Backend" \
  "Local Development Only"

DEPLOY_TARGET_IDX=$CHOICE_RESULT
case $DEPLOY_TARGET_IDX in
  0) DEPLOY_TARGET="docker" ;;
  1) DEPLOY_TARGET="vercel" ;;
  2) DEPLOY_TARGET="netlify" ;;
  3) DEPLOY_TARGET="local" ;;
  *) DEPLOY_TARGET="local" ;;
esac

print_success "Deploy target: ${DEPLOY_TARGET}"

# --- Step 5: Optional Services ---
print_step 5 "Optional Services"

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
    print_warning "Local storage: uploads saved to ./uploads/"
    ;;
esac

# SMTP
echo ""
echo -e "${CYAN}?${NC} Configure email (SMTP) for notifications?"
ask_choice "" "Yes" "No, skip for now"
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
echo -e "${CYAN}?${NC} Configure Redis for caching & rate limiting?"
ask_choice "" "Yes" "No, use in-memory (fine for small communities)"
if [ "$CHOICE_RESULT" = "0" ]; then
  ask "Redis URL" "redis://localhost:6379" REDIS_URL
else
  REDIS_URL=""
fi

# Stripe
echo ""
echo -e "${CYAN}?${NC} Enable Stripe integration (paid memberships)?"
ask_choice "" "Yes" "No"
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
VITE_API_URL=${API_URL}/api

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
SMTP_FROM_NAME=${SMTP_FROM_NAME:-${COMMUNITY_NAME}}

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
    # Update docker-compose with actual values
    print_success "Docker files already configured"
    echo -e "${YELLOW}  Run: docker-compose up --build${NC}"
    ;;
esac

# --- Step 7: Install Dependencies ---
print_step 7 "Installing dependencies"

echo -e "${CYAN}?${NC} Install npm dependencies now?"
ask_choice "" "Yes" "No, I'll do it later"

if [ "$CHOICE_RESULT" = "0" ]; then
  echo "Installing frontend dependencies..."
  npm install

  # Add Prisma if MongoDB selected
  if [ "$DB_PROVIDER" = "mongodb" ]; then
    echo "Installing Prisma..."
    npm install prisma @prisma/client
    npx prisma generate
  fi

  echo "Installing backend dependencies..."
  cd server && npm install && cd ..

  # Add JWT deps if MongoDB
  if [ "$DB_PROVIDER" = "mongodb" ]; then
    cd server
    npm install jsonwebtoken bcryptjs
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
  [ "$DB_PROVIDER" = "mongodb" ] && echo "  cd server && npm install jsonwebtoken bcryptjs"
fi

# --- Database Setup ---
if [ "$DB_PROVIDER" = "supabase-cloud" ] || [ "$DB_PROVIDER" = "supabase-selfhosted" ]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Database Setup (Supabase):${NC}"
  echo "  Run the consolidated schema in your Supabase SQL Editor:"
  echo "  - Copy and paste the contents of schema.sql into the SQL Editor"
  echo "  - Click 'Run' to create all tables, functions, and policies"
  echo ""
  echo "  Or use the Supabase CLI:"
  echo "  supabase db push"
elif [ "$DB_PROVIDER" = "mongodb" ]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Database Setup (MongoDB):${NC}"
  echo "  Run Prisma migrations:"
  echo "  npx prisma db push"
  echo ""
  echo "  Then seed the database:"
  echo "  npx prisma db seed"
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
    echo "  # Build and run"
    echo "  docker-compose up --build"
    ;;
  vercel)
    echo "  # Deploy frontend to Vercel"
    echo "  vercel deploy"
    echo ""
    echo "  # Deploy backend separately (e.g., Railway, Render, VPS)"
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
echo -e "${YELLOW}${BOLD}First Admin Setup:${NC}"
echo "  1. Sign up via the app"
echo "  2. Run in Supabase SQL Editor:"
echo "     SELECT setup_first_admin('your-email@example.com');"
echo ""
echo -e "${CYAN}Full guide: guides/self-hosted-setup.md${NC}"
echo ""
