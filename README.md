# Roost

**A self-hosted community platform for learning, building, and growing together.**

Roost is a full-featured, open-source community platform that you can deploy on your own infrastructure. Think Skool/Circle alternative that you own and control.

**[Product website and documentation](https://roost.msrbuilds.com)**

---

## Features

- **Community Feed** — Posts, comments, reactions, rich text editor, media uploads
- **Groups & Classrooms** — Public/private groups with roles (Admin, Moderator, Member)
- **Learn Mode** — Course modules with video lessons and progress tracking
- **Direct Messaging** — Real-time 1-on-1 chat with file attachments
- **Events & Calendar** — Event management with RSVP tracking
- **Leaderboard** — Points system for engagement tracking
- **Member Directory** — Searchable member profiles with online status
- **Showcase Gallery** — ProductHunt-style project showcase with voting & reviews
- **Admin Dashboard** — User management, content moderation, analytics
- **Live Room** — Live streaming with real-time chat
- **Notifications** — In-app + email notifications
- **Feature Requests** — Community-driven roadmap voting

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Express.js, Node.js 22+ |
| Database | Supabase (Cloud or self-hosted) |
| Storage | AWS S3 / S3-compatible (MinIO, R2) |
| Icons | Lucide React |
| Editor | Native sanitized rich-text editor |

## Quick Start

### Option 1: Interactive Installer (Recommended)

```bash
git clone https://github.com/msrbuilds/roost.git
cd roost
bash install.sh
```

The installer will guide you through:
- Database provider selection (Supabase Cloud or Supabase Self-hosted)
- Deployment target (Docker VPS, Dockploy VPS, Vercel, Netlify, Local dev)
- Storage, email, and optional integrations
- Docker VPS path includes Traefik + Let's Encrypt SSL and optional self-hosted MinIO profile
- Supabase self-hosted path can auto-generate JWT/anon/service keys and Dockploy-ready env values

### Option 2: Manual Setup

```bash
# Clone and install
git clone https://github.com/msrbuilds/roost.git
cd roost
npm install
cd server && npm install && cd ..

# Configure
cp .env.example .env.local
cp server/.env.example server/.env
# Edit both .env files with your values

# Start development
npm run dev          # Frontend (port 5000)
cd server && npm run dev  # Backend (port 3000)
```

## Database Providers

| Provider | Best For | Guide |
|----------|----------|-------|
| **Supabase Cloud** | Easiest setup, recommended for most | [Full Guide](guides/supabase-cloud.md) |
| **Supabase Self-hosted** | Full control, privacy-focused | [Full Guide](guides/supabase-selfhosted.md) |

## Deployment

| Platform | Type | Guide |
|----------|------|-------|
| **Docker (VPS)** | Self-hosted VPS with Docker Compose + Traefik SSL | [Full Guide](guides/docker-vps.md) |
| **Dockploy (VPS)** | Self-hosted VPS with Dockploy | [Full Guide](guides/dockploy-vps.md) |
| **Vercel** | Frontend only (backend separate) | [Full Guide](guides/vercel.md) |
| **Netlify** | Frontend only (backend separate) | [Full Guide](guides/netlify.md) |

Also see: [Interactive Installer Guide](guides/install-script.md)

## Configuration

### Environment Variables

See [.env.example](.env.example) for frontend and [server/.env.example](server/.env.example) for backend configuration.

### Feature Flags

Toggle features via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_SIGNUP` | `true` | Allow new user registration |
| `VITE_ENABLE_SHOWCASE` | `true` | Enable project showcase gallery |
| `VITE_ENABLE_LIVE_ROOM` | `true` | Enable live streaming room |
| `VITE_ENABLE_LEADERBOARD` | `true` | Enable points & leaderboard |
| `VITE_ENABLE_ACTIVATIONS` | `false` | Enable product activations |

## Project Structure

```
roost/
├── src/                    # Frontend (React)
│   ├── auth/               # Auth abstraction layer
│   │   ├── adapters/       # Supabase Auth
│   │   └── interfaces/     # Auth interface types
│   ├── db/                 # Database abstraction layer
│   │   ├── adapters/       # Supabase adapter
│   │   └── interfaces/     # Database interface types
│   ├── config/             # App configuration
│   ├── components/         # React components
│   ├── contexts/           # React context providers
│   ├── hooks/              # Custom hooks
│   ├── layouts/            # Page layouts
│   ├── pages/              # Page components
│   ├── services/           # API service layer
│   └── types/              # TypeScript types
├── server/                 # Backend (Express)
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Backend services
│       └── lib/            # Shared utilities
├── schema.sql              # Consolidated schema for fresh Supabase installs
├── guides/                 # Step-by-step setup & deployment guides
├── website/                # Astro product website and searchable documentation
├── install.sh              # Interactive installer
├── docker-compose.yml      # Docker orchestration
├── docker-compose.dokploy.yml # Dockploy orchestration
├── Dockerfile              # Frontend container
├── vercel.json             # Vercel config
├── netlify.toml            # Netlify config
└── nginx.conf              # Nginx config (Docker)
```

## Development

```bash
# Run both frontend and backend
npm run dev:all

# Run tests
npm test

# Type check
npx tsc --noEmit

# Lint
npm run lint

# E2E tests
npm run test:e2e
```

## License

MIT

## Local documentation installation

For a writable sample community with an owner account, use the loopback-only
Compose override. This is a separate development installation with its own
volumes, private storage, and Mailpit inbox. Do not use these settings publicly.
Docker Desktop with Linux containers and Docker Compose v2 is required.

```bash
node scripts/create-screenshot-env.cjs
docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml up -d --build
docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml exec -T -e ROOST_SCREENSHOT_SEED=true backend node scripts/seed-screenshots.cjs
```

Open http://127.0.0.1:15489. The fictional member account is
`demo@roost.example` / `ExploreRoost2026!`. The owner is `owner@roost.example`;
its random password is `LOCAL_ADMIN_PASSWORD` in the ignored
`.env.screenshots.local` file. The generator refuses to overwrite that file.
Email stays in the private inbox at http://127.0.0.1:15490. Stripe is disabled.
The fixture seed refuses non-local origins and databases with non-fixture users.

To stop this installation without deleting its data:

```bash
docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml stop
```

Member and administration walkthroughs are in [Using Roost](guides/using-roost.md)
and [Administration](guides/administration.md).
