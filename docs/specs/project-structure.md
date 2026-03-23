# Project Structure Specification

## Overview

This document describes the folder structure and organization of the Commune community platform built with React, TypeScript, and Vite.

---

## Root Directory Structure

```
commune/
├── .agent/                     # Agent configuration and workflows
├── docs/                       # Documentation
│   ├── specs/                  # Feature specifications
│   ├── development_plan.md    # Development roadmap
│   ├── gumroad_integration.md # Gumroad integration guide
│   └── dokploy_deployment.md  # Deployment guide
├── migrations/                 # Supabase SQL migrations
├── public/                     # Static assets
├── src/                        # Source code
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── postcss.config.js          # PostCSS configuration
├── tailwind.config.js         # TailwindCSS configuration
├── tsconfig.json              # TypeScript configuration
├── tsconfig.node.json         # Node TypeScript config
└── vite.config.ts             # Vite configuration
```

---

## Source Directory (`/src`)

```
src/
├── components/                 # Reusable UI components
│   ├── auth/                  # Authentication components
│   │   └── ProtectedRoute.tsx # Route guard for auth
│   ├── navigation/            # Navigation components
│   │   └── TopNav.tsx         # Main navigation bar
│   ├── ui/                    # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── feed/                  # Feed-related components
│   │   ├── PostCard.tsx
│   │   ├── PostForm.tsx
│   │   └── CommentThread.tsx
│   └── common/                # Shared components
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       └── Skeleton.tsx
│
├── pages/                      # Route-based page components
│   ├── auth/                  # Authentication pages
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── ForgotPassword.tsx
│   ├── Home.tsx               # Main feed page
│   ├── Profile.tsx            # User profile page
│   ├── Settings.tsx           # User settings
│   ├── Messages.tsx           # Direct messages
│   └── Members.tsx            # Members directory
│
├── layouts/                    # Layout wrapper components
│   ├── MainLayout.tsx         # Authenticated layout with nav
│   ├── AuthLayout.tsx         # Auth pages layout
│   └── index.ts               # Barrel export
│
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts             # Auth hook (from context)
│   ├── usePosts.ts            # Posts data hook
│   ├── useProfile.ts          # Profile data hook
│   └── useRealtime.ts         # Realtime subscription hook
│
├── services/                   # API and external services
│   ├── supabase.ts            # Supabase client and helpers
│   ├── s3.ts                  # AWS S3 file upload service
│   └── index.ts               # Barrel export
│
├── contexts/                   # React context providers
│   ├── AuthContext.tsx        # Authentication state
│   └── index.ts               # Barrel export
│
├── utils/                      # Utility functions
│   ├── formatDate.ts          # Date formatting helpers
│   ├── cn.ts                  # classNames utility
│   └── validators.ts          # Input validation
│
├── types/                      # TypeScript type definitions
│   ├── database.ts            # Supabase database types
│   └── index.ts               # Barrel export
│
├── App.tsx                    # Main app with routing
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

---

## Component Organization

### Naming Conventions

- **Components**: PascalCase (e.g., `PostCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePosts.ts`)
- **Utils**: camelCase (e.g., `formatDate.ts`)
- **Types**: camelCase (e.g., `database.ts`)

### File Structure for Components

```tsx
// ComponentName.tsx

import { ... } from 'react';
import { ... } from '@/services';
import { ... } from '@/types';

// Types
interface ComponentNameProps {
  // props
}

// Component
export default function ComponentName({ ... }: ComponentNameProps) {
  // state
  // effects
  // handlers
  // render
}
```

### Barrel Exports

Each directory has an `index.ts` that exports all public modules:

```ts
// index.ts
export { default as ComponentA } from './ComponentA';
export { default as ComponentB } from './ComponentB';
export * from './types';
```

---

## Import Path Aliases

Configured in `tsconfig.json` for clean imports:

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@/components/*` | `src/components/*` |
| `@/pages/*` | `src/pages/*` |
| `@/layouts/*` | `src/layouts/*` |
| `@/hooks/*` | `src/hooks/*` |
| `@/services/*` | `src/services/*` |
| `@/utils/*` | `src/utils/*` |
| `@/types/*` | `src/types/*` |
| `@/contexts/*` | `src/contexts/*` |

**Usage:**

```tsx
// Instead of:
import { supabase } from '../../../services/supabase';

// Use:
import { supabase } from '@/services/supabase';
```

---

## Key Files

### `/src/main.tsx`

Entry point that sets up:
- React StrictMode
- BrowserRouter for routing
- AuthProvider for auth state
- Renders App component

### `/src/App.tsx`

Main routing configuration:
- Auth routes (login, signup, forgot-password)
- Protected routes with MainLayout
- Route guards via ProtectedRoute

### `/src/index.css`

Global styles including:
- Tailwind directives (@tailwind base, components, utilities)
- Custom component classes (.btn, .card, .input, etc.)
- Utility extensions (.scrollbar-thin, .line-clamp-*)

---

## Static Assets (`/public`)

```
public/
├── vite.svg           # Default Vite icon
├── favicon.ico        # Site favicon
└── images/            # Static images
    └── logo.svg       # App logo
```

---

## Documentation (`/docs`)

```
docs/
├── specs/             # Feature specifications
│   ├── project-structure.md
│   ├── tailwind-config.md
│   ├── supabase-integration.md
│   ├── s3-integration.md
│   └── environment-variables.md
├── development_plan.md
├── implementation_plan.md
├── gumroad_integration.md
└── dokploy_deployment.md
```

---

## Migrations (`/migrations`)

SQL migration files for Supabase:

```
migrations/
├── 001_initial_schema.sql     # Core tables
├── 002_rls_policies.sql       # Row Level Security
├── 003_functions_triggers.sql # Database functions
├── 004_gumroad_integration.sql # Gumroad tables
└── README.md                   # Migration guide
```

---

## Best Practices

1. **Keep components small** - Extract reusable parts into separate files
2. **Use TypeScript strictly** - All props and state should be typed
3. **Co-locate tests** - Place test files next to components (`Component.test.tsx`)
4. **Lazy load routes** - Use `React.lazy()` for code splitting
5. **Document complex logic** - Add comments for non-obvious code

---

## Adding New Features

1. Create page component in `/src/pages/`
2. Add route in `/src/App.tsx`
3. Create any needed components in `/src/components/`
4. Update barrel exports (`index.ts`)
5. Create spec document in `/docs/specs/`
