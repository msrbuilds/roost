# Development Plan - Commune Community Platform

## Project Overview

Building the Commune community platform using React (Vite), TypeScript, TailwindCSS, Supabase (PostgreSQL), and AWS S3. This is an internal-use SPA focused on speed and user experience.

---

## Development Phases

### Phase 1: Foundation & Setup (Week 1) ✅ COMPLETE

#### 1.1 Project Initialization
- [x] Initialize Vite + React + TypeScript project
- [x] Configure TailwindCSS with custom theme
- [x] Set up project structure and folder organization
- [x] Configure environment variables (`.env.example`)

#### 1.2 Supabase Setup
- [x] Create Supabase client configuration
- [x] Create Supabase project (user action required)
- [x] Run initial database migrations (see `/migrations` folder)
- [x] Set up authentication (Email/Password) - client code ready
- [x] AuthContext with user state management

#### 1.3 AWS S3 Setup
- [x] Create S3 client configuration
- [x] Set up file upload utilities
- [x] Integrate `@aws-sdk/client-s3` library
- [x] Create S3 buckets (user action required)
- [x] Configure IAM user and access keys (user action required)

---

### Phase 2: Core Authentication & User System (Week 2)

#### 2.1 Authentication Pages ✅
- [x] `/login` - Email/Password login
- [x] `/signup` - User registration
- [x] `/forgot-password` - Password recovery
- [x] Protected route wrapper component

#### 2.2 User Profile Management ✅
- [x] Profile page (`/profile`)
- [x] Profile editing page (`/settings`)
- [x] Avatar upload to S3
- [x] Username and display name management

#### 2.3 Database Integration ✅
- [x] Profile service with CRUD operations
- [x] Real-time profile updates
- [x] User presence tracking (online status)

---

### Phase 3: Layout & Navigation (Week 3) ✅ COMPLETE

#### 3.1 Main Layout Components ✅
- [x] `TopNav` - Horizontal navigation bar
  - Logo
  - Centered search bar
  - Navigation tabs (Community, Classroom, Calendar, Members, Leaderboards, About)
  - Profile dropdown
  - Notifications bell icon
- [x] `MainLayout` - Responsive layout wrapper
- [x] `AuthLayout` - Auth pages layout

#### 3.2 Design System Implementation ✅
- [x] Color palette configuration in Tailwind
- [x] Spacing and typography system
- [x] Component classes (buttons, cards, inputs)

---

### Phase 4: Community Feed & Posts (Week 4-5) ✅ COMPLETE

#### 4.1 Feed Components
- [x] Post feed with infinite scroll
- [x] Category filter buttons (All, General, YouTube, etc.)
- [x] "Write something" trigger component
- [x] Post creation modal with rich text editor

#### 4.2 Post Features
- [x] Create posts with text, images
- [x] Edit and delete own posts
- [x] Pin/Unpin posts (admin feature)
- [x] Post reactions (likes, emoji reactions)
- [x] Comment threads on posts

#### 4.3 Media Handling
- [x] Image uploads to S3 with preview
- [x] YouTube/Vimeo embed detection and rendering
- [x] Multi-image gallery in posts
- [x] Video thumbnail generation (placeholder with play button)

#### 4.4 Real-time Updates
- [x] Supabase real-time subscription for new posts
- [x] Live comment updates
- [x] Live reaction counts


---

### Phase 5: Groups & Communities (Week 5-6) ✅ COMPLETE

#### 5.1 Group Management
- [x] Create groups (any authenticated user)
- [x] Group settings page
- [x] Group member management
- [x] Group roles (admin, moderator, member)

#### 5.2 Group Features
- [x] Join/Leave groups
- [x] Private vs Public groups
- [x] Group-specific feeds
- [ ] Group invitations (deferred to future)

---

### Phase 6: Messaging System (Week 6-7) ✅ COMPLETE

#### 6.1 Direct Messaging ✅
- [x] Message inbox list
- [x] 1-on-1 chat interface
- [x] Real-time message delivery
- [x] Message read receipts
- [x] File sharing in messages
- [x] Conversation aggregation
- [x] Infinite scroll for message history
- [x] User search for new conversations
- [x] Mobile responsive layout
- [x] Optimistic updates
- [x] Keyboard shortcuts (Ctrl+Enter)

#### 6.2 Notifications ✅
- [x] Notification center component
- [x] Push notification triggers:
  - [x] New messages
  - [x] Post comments
  - [x] Post reactions
  - [x] Mentions
  - [x] Group invites
- [x] Real-time notification delivery
- [x] Unread count badges
- [x] Mark as read (single/bulk)
- [x] Click to navigate to source
- [ ] Email notification preferences (deferred to future)

---

### Phase 7: Advanced Features (Week 7-8) ✅ COMPLETE

#### 7.1 Leaderboard System ✅
- [x] Points calculation system (database functions)
- [x] Leaderboard API endpoints (service layer)
- [x] Leaderboard card component (30-day + all-time)
- [x] User ranks and point activity feed
- [x] Automated point triggers for posts, comments, reactions, events

#### 7.2 Calendar & Events ✅
- [x] Event creation and management
- [x] Calendar view (month view with react-big-calendar)
- [x] Event RSVP system (Going/Maybe/Not Going)
- [x] Event details modal with attendee list
- [x] Upcoming events sidebar
- [x] Group-specific and community-wide events

#### 7.3 Members Directory ✅
- [x] Member list with search/filter
- [x] Member profiles (via MemberCard -> Profile link)
- [x] Online status indicators
- [/] Admin/Moderator badges (implemented placeholder, awaiting role system)

---

### Phase 8: Admin Dashboard (Week 8-9) ✅ COMPLETE

#### 8.1 Admin Features ✅
- [x] Admin dashboard page
- [x] User management (ban, promote, demote)
- [x] Content moderation (delete posts/comments)
- [x] Analytics overview (members, posts, engagement)

#### 8.2 Content Management ✅
- [x] Category management (with platform admin RLS policies)
- [x] Featured posts (integrated via pinned posts moderation)
- [x] Announcement system (full CRUD with global/group scope)

#### 8.3 Ban Enforcement ✅
- [x] Frontend ban checking in AuthContext
- [x] ProtectedRoute redirect to /banned for banned users
- [x] Dedicated Banned page with ban info display
- [x] Temporary ban expiration handling
- [x] Permanent ban support

---

### Phase 9: Gumroad Integration (Week 9) ✅ COMPLETE

#### 9.1 Database Schema for Gumroad ✅
- [x] Run migration `004_gumroad_integration.sql`
- [x] Create `gumroad_customers` table
- [x] Create `gumroad_subscriptions` table
- [x] Create `gumroad_webhook_logs` table

#### 9.2 Webhook Endpoint Setup ✅
- [x] Create webhook handler endpoint `/api/webhooks/gumroad`
- [x] Implement webhook payload validation with Zod
- [x] Set up webhook URL in Gumroad settings
- [x] Test webhook with Gumroad's "Send test ping"

#### 9.3 Purchase Event Handling ✅
- [x] Handle `sale` event from Gumroad
- [x] Automatically create Supabase user account
- [x] Send welcome email with login credentials (SMTP)
- [x] Create user profile with Gumroad metadata
- [x] Add user to appropriate group based on product

#### 9.4 Subscription Management ✅
- [x] Handle `subscription_updated` event
- [x] Handle `subscription_ended` event (cancellation)
- [x] Handle `subscription_restarted` event
- [x] Handle `refund` event
- [x] Update user access permissions based on subscription status

#### 9.5 Gumroad API Integration ✅
- [x] Set up Gumroad API client with access token
- [x] Implement `GET /subscribers` to sync existing customers
- [x] Implement `GET /sales` for historical data
- [x] Create admin sync tool for one-time import
- [x] Admin Gumroad management page with sync actions

#### 9.6 User Access Control ✅
- [x] Create ProtectedRoute middleware to check subscription status
- [x] Implement grace period for expired subscriptions (7 days)
- [x] Create "Subscription Required" page for inactive users
- [x] Add subscription status indicator in user settings

---

### Phase 10: Testing & Optimization (Week 10) ✅ COMPLETE

#### 10.1 Testing ✅
- [x] Set up Vitest with React Testing Library
- [x] Configure coverage reporting (70% threshold)
- [x] Integration tests for services (post, message, notification)
- [x] Install and configure Playwright for E2E testing
- [x] E2E tests for critical user flows:
  - [x] Authentication flow (login, signup, forgot password)
  - [x] Post creation and interaction (create, react, comment)
- [ ] Performance testing (Lighthouse scores)

#### 10.2 Optimization ✅
- [x] Code splitting with React.lazy() for all pages
- [x] Suspense fallback with loading spinner
- [x] Bundle size optimization with vendor chunking:
  - vendor-react (178 KB)
  - vendor-supabase (174 KB)
  - vendor-aws (205 KB)
  - vendor-ui (59 KB)
- [ ] Image optimization (WebP, lazy loading)
- [ ] Database query optimization
- [ ] Implement caching strategies

### 10.3 Security ✅
- [x] Security audit (XSS, CSRF, SQL injection) - Completed comprehensive audit
- [x] Fix critical XSS vulnerability with DOMPurify sanitization
- [x] Fix email template injection vulnerabilities (escapeHtml)
- [x] Review and tighten RLS policies - Migration 019 created
- [x] Rate limiting on API endpoints (server already configured)

#### Security Fixes Applied:
- **XSS Prevention**: DOMPurify added to PostCard for HTML sanitization
- **Email Security**: HTML escaping for all user-provided data in email templates
- **RLS Hardening** (Migration 019):
  - Fixed leaderboard_entries (removed `USING (true)` ALL grant)
  - Fixed point_activities (removed permissive INSERT)
  - Fixed comments (restored group privacy awareness)
  - Fixed reactions (restricted to visible posts/comments)
  - Fixed assets (context-aware visibility)
  - Added webhook logs admin policy
---

### Phase 11: Deployment & Launch (Week 11) 🏗 IN PROGRESS

#### 11.1 Docker Containerization ✅
- [x] Create `Dockerfile` for production build (multi-stage: Node → nginx)
- [x] Create `.dockerignore` file
- [x] Create `docker-compose.yml` for local testing
- [x] Test Docker build locally
- [x] Optimize image size (multi-stage builds)
- [x] Create backend `server/Dockerfile` for Express server
- [x] Create `nginx.conf` for SPA routing

#### 11.2 Dokploy Setup ✅
- [x] Set up VPS
- [x] Install Dokploy on server
- [x] Configure domain and DNS settings (your-domain.com)
- [x] Set up SSL certificates (automatic via Let's Encrypt)
- [x] Configure Traefik reverse proxy

#### 11.3 Deployment Configuration ⏳
- [x] Connect GitHub repository to Dokploy
- [x] Configure environment variables in Dokploy
- [x] Set up automatic deployments via webhooks
- [x] Configure Supabase production instance
- [x] Configure S3 production buckets
- [ ] Set up database backups

#### 11.4 Launch Preparation
- [ ] Final user acceptance testing
- [ ] Create user documentation
- [ ] Set up error monitoring (Sentry)
- [ ] Configure monitoring and alerts in Dokploy
- [ ] Set up log aggregation

#### 11.5 Go Live
- [x] Deploy to production via Dokploy
- [x] Monitor resource usage (CPU, memory, disk)
- [x] Monitor logs and errors
- [ ] Test all critical user flows
- [ ] Gather user feedback
- [ ] Plan iteration cycles

---

## Technology Stack Summary

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| **Build Tool** | Vite 6 | Fast development and building |
| **Language** | TypeScript | Type safety |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Backend** | Supabase | Authentication, Database, Real-time |
| **Database** | PostgreSQL | Relational data storage |
| **Storage** | AWS S3 | File and media storage |
| **Payments** | Gumroad | Membership sales and subscriptions |
| **Containerization** | Docker | Application containerization |
| **Deployment** | Dokploy | Self-hosted PaaS deployment platform |

---

## Database Schema Overview

See `/migrations` folder for detailed SQL scripts. Key tables include:

1. **profiles** - User profiles with metadata
2. **groups** - Community groups
3. **group_members** - Group membership tracking
4. **posts** - Community posts
5. **comments** - Post comments
6. **reactions** - Reactions to posts and comments
7. **messages** - Direct messages
8. **notifications** - User notifications
9. **assets** - Uploaded files and media
10. **leaderboard_entries** - Points and ranking data
11. **events** - Calendar events
12. **categories** - Post categories

---

## File Structure

```
commune/
├── migrations/                 # Supabase SQL migration files
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_functions_triggers.sql
│   └── 004_gumroad_integration.sql
├── src/
│   ├── components/            # Reusable UI components
│   ├── pages/                 # Route-based page components
│   ├── layouts/               # Layout wrappers
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # API and external service logic
│   │   ├── gumroad.ts        # Gumroad API client
│   │   └── supabase.ts       # Supabase client
│   ├── utils/                 # Helper functions
│   ├── types/                 # TypeScript type definitions
│   └── contexts/              # React context providers
├── public/                    # Static assets
├── docs/                      # Documentation
└── package.json
```

---

## Development Guidelines

### Code Style
- Use functional components with hooks
- Follow TypeScript strict mode
- Use ESLint and Prettier for formatting
- Write meaningful component and variable names

### Git Workflow
- Create feature branches: `feature/post-creation`
- Commit messages: `feat: add post creation modal`
- Pull request reviews before merging to main

### Testing Strategy
- Write tests alongside features
- Aim for 70%+ code coverage
- Test user flows, not implementation details

---

## Success Metrics

- [ ] Clean, minimal UI matching Commune aesthetic
- [ ] Real-time updates working (<500ms latency)
- [ ] Page load times <2 seconds
- [ ] Mobile-responsive design
- [ ] Zero critical security vulnerabilities
- [ ] Positive user feedback from internal testing

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| Supabase rate limits | Implement client-side caching, optimize queries |
| S3 costs | Use image compression, implement CDN |
| Real-time performance | Use debouncing, limit subscriptions |
| Security vulnerabilities | Regular audits, RLS policies, input validation |
| Scope creep | Stick to MVP features, plan v2 separately |
| Server downtime | Use Dokploy monitoring, set up health checks |
| Resource constraints | Monitor usage in Dokploy, scale VPS as needed |

---

## Next Steps

1. ✅ Review and approve this development plan
2. ⏳ Run database migrations in Supabase
3. ⏳ Set up AWS S3 buckets and IAM
4. ⏳ Begin Phase 1: Foundation & Setup
