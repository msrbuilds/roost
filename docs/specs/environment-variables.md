# Environment Variables Specification

## Overview

This document describes all environment variables required for the Commune platform, their purpose, and how to configure them.

---

## Configuration File

**Template:** `/.env.example`
**Local:** `/.env.local` (not committed to git)

---

## Required Variables

### Supabase

| Variable | Type | Description |
|----------|------|-------------|
| `VITE_SUPABASE_URL` | String | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | String | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | String | Service role key (server-side only) |

**Where to find:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the Project URL and keys

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### AWS S3

| Variable | Type | Description |
|----------|------|-------------|
| `VITE_AWS_REGION` | String | AWS region (e.g., `us-east-1`) |
| `VITE_AWS_S3_BUCKET` | String | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | String | IAM access key (server-side only) |
| `AWS_SECRET_ACCESS_KEY` | String | IAM secret key (server-side only) |

**Where to find:**
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Users → Select user → Security credentials
3. Create access key if needed

```env
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=commune-uploads
# IMPORTANT: never put AWS credentials in `VITE_*` env vars (they are browser-visible).
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

## Optional Variables

### Gumroad (Membership Integration)

| Variable | Type | Description |
|----------|------|-------------|
| `GUMROAD_ACCESS_TOKEN` | String | Gumroad API access token |
| `GUMROAD_WEBHOOK_TOKEN` | String | Shared token for webhook URL verification |

**Where to find:**
1. Go to [Gumroad Settings](https://app.gumroad.com/settings/advanced)
2. Copy access token
3. Set up webhook endpoint URL

```env
GUMROAD_ACCESS_TOKEN=abc123...
GUMROAD_WEBHOOK_TOKEN=your-webhook-token
```

### Application Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_APP_NAME` | String | `Commune` | Application name |
| `VITE_APP_URL` | String | `http://localhost:3000` | Application URL |

```env
VITE_APP_NAME=My Community
VITE_APP_URL=https://community.example.com
```

### Development Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_ENABLE_MOCK_DATA` | Boolean | `false` | Enable mock data for testing |
| `VITE_DEBUG_MODE` | Boolean | `false` | Enable debug logging |

```env
VITE_ENABLE_MOCK_DATA=false
VITE_DEBUG_MODE=true
```

---

## Variable Naming Convention

- **`VITE_` prefix**: Exposed to client-side code (bundled with app)
- **No prefix**: Server-side only (webhooks, edge functions)

> ⚠️ **Security Warning**: Never use `VITE_` prefix for sensitive keys that should remain server-side (like `SUPABASE_SERVICE_ROLE_KEY`).

---

## Accessing Variables

### In React Components

```typescript
// Client-side (VITE_ prefix required)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const appName = import.meta.env.VITE_APP_NAME;
```

### In Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
```

### Environment Detection

```typescript
// Check current environment
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
const mode = import.meta.env.MODE; // 'development' | 'production'
```

---

## Environment Files

Vite loads environment files in this order:

| File | Purpose | Loaded |
|------|---------|--------|
| `.env` | Default values | Always |
| `.env.local` | Local overrides | Always (gitignored) |
| `.env.development` | Dev-specific | Dev mode only |
| `.env.production` | Prod-specific | Prod build only |
| `.env.development.local` | Local dev overrides | Dev mode (gitignored) |
| `.env.production.local` | Local prod overrides | Prod build (gitignored) |

---

## Setting Up Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your values:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-key
   # ... etc
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

---

## Production Deployment

### Dokploy

1. Go to application settings
2. Navigate to **Environment Variables**
3. Add each variable

### Vercel

1. Go to project settings
2. Navigate to **Environment Variables**
3. Add for Production/Preview/Development

### Docker

```dockerfile
ENV VITE_SUPABASE_URL=https://prod.supabase.co
ENV VITE_SUPABASE_ANON_KEY=production-key
```

Or use docker-compose:

```yaml
services:
  app:
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
```

---

## Validation

The app validates required variables on startup:

```typescript
// In services/supabase.ts
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

// In services/s3.ts
if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
  console.warn(
    'Missing AWS S3 environment variables. File uploads will not work.'
  );
}
```

---

## TypeScript Types

Add type definitions for custom env variables:

```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AWS_REGION: string;
  readonly VITE_AWS_S3_BUCKET: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_ENABLE_MOCK_DATA: string;
  readonly VITE_DEBUG_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] No sensitive keys have `VITE_` prefix
- [ ] Service role key is only used server-side
- [ ] Access keys have minimum required permissions
- [ ] Keys are rotated regularly
- [ ] Different keys used for dev/staging/production
