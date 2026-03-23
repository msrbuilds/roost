# Roost - Self-Hosted Community Platform

## Overview
Roost is an installable, self-hosted community platform supporting multiple database backends (Supabase Cloud, Supabase Self-hosted, MongoDB + Prisma). It's a full-featured Skool/Circle alternative that users deploy on their own infrastructure.

---

## Core Stack
- **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS
- **Backend**: Express.js (Node.js 20+)
- **Database**: Supabase (default) or MongoDB + Prisma
- **Auth**: Supabase Auth or Local JWT (MongoDB)
- **Storage**: AWS S3 / S3-compatible (MinIO, Cloudflare R2)
- **Payments**: Stripe (optional)
- **Containerization**: Docker (multi-stage builds)
- **Deployment**: Dokploy, Vercel, Netlify, or any VPS
- **Icons**: Lucide React
- **Editor**: React Quill (rich text)

---

## UI Rules
- **No box shadows on cards** — use borders only for card elevation, never `shadow-*` classes.

---

## Architecture

### Database Abstraction Layer
The app uses an **adapter pattern** to support multiple database backends:

```
src/db/
├── interfaces/          # TypeScript interfaces all adapters implement
│   ├── types.ts         # Shared types (Profile, Post, Group, etc.)
│   ├── database.ts      # DatabaseAdapter interface (112 methods)
│   └── index.ts         # Re-exports
├── adapters/
│   ├── supabase/        # Supabase adapter (Cloud + Self-hosted)
│   │   └── index.ts     # SupabaseAdapter class (~1,855 lines)
│   └── mongodb/         # MongoDB + Prisma adapter
│       └── index.ts     # MongoDBAdapter class (~2,948 lines)
├── config.ts            # Reads VITE_DB_PROVIDER env var
└── index.ts             # Factory: getDatabase() / db()
```

### Auth Abstraction Layer
```
src/auth/
├── interfaces/          # AuthAdapter interface
│   ├── auth.ts          # AuthAdapter, AuthUser, AuthSession types
│   └── index.ts
├── adapters/
│   ├── supabase/        # Wraps supabase.auth.*
│   │   └── index.ts
│   └── local/           # JWT + API calls for MongoDB
│       └── index.ts
└── index.ts             # Factory: getAuth() / auth()
```

### App Configuration
```
src/config/app.ts        # APP_CONFIG — name, tagline, features, URLs
```
All branding is configurable via `VITE_APP_NAME`, `VITE_APP_TAGLINE`, etc.

### Service Layer
```
src/services/            # 28 service files (~8,900 lines total)
```
**Note**: Services currently use direct Supabase calls. The migration path is to refactor them to use `db()` from the abstraction layer. The adapters are ready; service migration is incremental.

### Component Structure
```
src/components/          # 115+ components across 20 subdirectories
├── feed/                # Posts, comments, reactions (12 components)
├── groups/              # Groups, membership, learn mode (22 components)
├── messages/            # DM chat (7 components)
├── admin/               # Admin UI (3 components)
├── navigation/          # TopNav, SideNav
├── events/              # Calendar, events (5 components)
├── showcase/            # Project showcase (6 components)
├── leaderboard/         # Points, rankings (4 components)
├── members/             # Directory (4 components)
├── notifications/       # Notification center (3 components)
└── ...                  # profile, settings, search, live-room, etc.
```

### Pages & Routes (47 routes)
```
src/pages/               # 31 page components
├── auth/                # Login, Signup, ForgotPassword, etc. (7 routes)
├── admin/               # Dashboard, Users, Content, etc. (8 routes)
└── ...                  # Home, Groups, Messages, Calendar, etc. (22 routes)
```

### Server (Express Backend)
```
server/src/
├── routes/              # 16+ route files
│   ├── auth.ts          # JWT auth routes (MongoDB path)
│   ├── stripe-webhook.ts
│   ├── stripe-api.ts
│   ├── upload.ts
│   ├── notifications.ts
│   ├── password-reset.ts
│   ├── two-factor.ts
│   ├── backup.ts
│   ├── live-room.ts
│   └── health.ts
├── services/
│   ├── email.ts         # SMTP email (configurable from name)
│   ├── stripe.ts
│   └── backup.ts
├── lib/
│   ├── supabase.ts      # Admin client
│   └── redis.ts         # Cache/rate limiting
└── middleware/
    └── redis-rate-limit.ts
```

### Database Schema
- **Supabase**: `schema.sql` (consolidated) or incremental migrations in `migrations/` (PostgreSQL)
- **MongoDB**: `prisma/schema.prisma` (40 models, 908 lines)
- **40 tables/collections**: profiles, groups, posts, comments, reactions, messages, notifications, events, showcases, modules, recordings, etc.
- **60+ database functions** (Supabase), implemented in application code for MongoDB

---

## Key Commands

### Frontend
```bash
npm run dev              # Start dev server (Vite, port 5173)
npm run build            # Production build (tsc + vite)
npm run lint             # ESLint
npm test                 # Vitest
npm run test:e2e         # Playwright E2E
npx tsc --noEmit         # Type check
```

### Backend
```bash
cd server && npm run dev     # Dev with hot reload
cd server && npm run build   # Compile TypeScript
cd server && npm start       # Production
```

### Both
```bash
npm run dev:all          # Frontend + backend concurrently
npm run build:all        # Build both
npm run install:all      # Install deps for both
```

### Docker
```bash
docker-compose up --build    # Build and run
docker-compose up -d         # Detached mode
docker-compose logs -f       # View logs
```

### Prisma (MongoDB only)
```bash
npx prisma generate          # Generate client
npx prisma db push           # Push schema to MongoDB
npx prisma studio            # Visual DB browser
npx prisma validate          # Validate schema
```

### Setup
```bash
bash install.sh              # Interactive installer
```

---

## Database Providers

| Provider | Env Value | Auth | Realtime | RLS |
|----------|-----------|------|----------|-----|
| Supabase Cloud | `supabase-cloud` | Supabase Auth | PostgreSQL Changes | Database-level |
| Supabase Self-hosted | `supabase-selfhosted` | Supabase Auth | PostgreSQL Changes | Database-level |
| MongoDB + Prisma | `mongodb` | JWT (local) | Polling (Change Streams planned) | Application-level |

Set via `VITE_DB_PROVIDER` in `.env.local`.

---

## Environment Variables

### Frontend (.env.local)
- `VITE_DB_PROVIDER` — `supabase-cloud` | `supabase-selfhosted` | `mongodb`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase credentials
- `VITE_DATABASE_URL` — MongoDB connection string
- `VITE_APP_NAME` / `VITE_APP_TAGLINE` — Branding
- `VITE_APP_URL` / `VITE_API_URL` — URLs
- `VITE_AWS_REGION` / `VITE_AWS_S3_BUCKET` — Storage
- `VITE_ENABLE_SIGNUP` / `VITE_STRIPE_ENABLED` / etc. — Feature flags

### Backend (server/.env)
- `DB_PROVIDER` — Must match frontend
- `SUPABASE_URL` / `SUPABASE_SECRET_KEY` — Supabase admin
- `DATABASE_URL` / `JWT_SECRET` — MongoDB + JWT
- `AWS_*` — S3 credentials
- `SMTP_*` — Email configuration
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` — Stripe payment integration
- `REDIS_URL` — Caching (optional)

See `.env.example` and `server/.env.example` for full reference.

---

## Deployment Options
- **Docker / Dokploy** — `docker-compose.yml` with Traefik labels
- **Vercel** — `vercel.json` for frontend, backend deployed separately
- **Netlify** — `netlify.toml` for frontend, backend deployed separately
- **Local dev** — `npm run dev:all`

---

## Guides
Step-by-step guides are in `guides/`:
- `guides/supabase-cloud.md` — Supabase Cloud setup
- `guides/supabase-selfhosted.md` — Self-hosted Supabase
- `guides/mongodb-prisma.md` — MongoDB + Prisma setup
- `guides/docker-dokploy.md` — Docker & Dokploy deployment
- `guides/vercel.md` — Vercel deployment
- `guides/netlify.md` — Netlify deployment
- `guides/install-script.md` — Interactive installer usage

---

## Important Notes for Development

### Service Migration Status
The existing `src/services/` files make direct Supabase calls. The database abstraction layer (`src/db/`) is complete with both adapters, but the services have not yet been refactored to use it. When modifying services:
- For Supabase-only changes: edit `src/services/` directly
- For multi-DB changes: use `db()` from `src/db/`
- The migration is incremental — each service can be refactored independently

### Realtime (MongoDB)
MongoDB adapter returns no-op subscriptions for realtime methods. Components using realtime should fall back to polling when the subscription returns immediately. MongoDB Change Streams + WebSocket support is planned.

### Access Control (MongoDB)
Without Supabase RLS, the MongoDB adapter implements access checks in application code within each method. Any new methods must include their own permission checks.
