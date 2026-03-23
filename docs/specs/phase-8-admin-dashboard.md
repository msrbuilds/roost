# Phase 8: Admin Dashboard Specification

## 1. Overview
The Admin Dashboard provides platform administrators and moderators with a centralized interface to manage users, moderate content, configure categories, and communicate via announcements.

## 2. Database Schema (Migration 017)

### Profiles Table Extensions
- `is_banned`: Boolean (Default false)
- `ban_expires_at`: Timestamp (Nullable)
- `ban_reason`: Text (Nullable)
- `banned_by`: UUID (FK to profiles, Nullable)
- `banned_at`: Timestamp (Nullable)

### Announcements System
- **`announcements` Table**:
    - `id`: UUID (PK)
    - `title`: Text
    - `content`: Text
    - `type`: Enum ('info', 'success', 'warning', 'error')
    - `scope`: Enum ('global', 'group')
    - `group_id`: UUID (FK to groups, Nullable)
    - `is_active`: Boolean (Default true)
    - `is_dismissible`: Boolean (Default true)
    - `starts_at`: Timestamp (Nullable)
    - `expires_at`: Timestamp (Nullable)
    - `created_by`: UUID (FK to profiles)

- **`announcement_dismissals` Table**:
    - `announcement_id`: UUID (FK to announcements)
    - `user_id`: UUID (FK to profiles)
    - `created_at`: Timestamp

## 3. Security & RBAC
- **Admin Access**: Protected via `AdminRoute` component and `is_platform_admin` check.
- **RLS Policies**:
    - `announcements`: Publicly viewable if active; editable only by admins.
    - `profiles`: Self-service updates; role/ban fields editable only by admins.
    - `content`: Deletion permitted for content owners OR users with admin/mod roles.

## 4. Service Layer (`admin.ts`)
Keys functions implemented (note: some use direct queries as stopgap for untyped RPCs):
- `getUsers`: Paginated user list with role filtering.
- `banUser` / `unbanUser`: Manage user access with duration.
- `updateUserRole`: Promote/demote users (Superadmin only).
- `getPostsForModeration` / `getCommentsForModeration`: Aggregate content for review.
- `getDashboardStats`: Real-time platform metrics aggregator.
- `getAnnouncements` / `getActiveAnnouncements`: Fetch banners based on status and scope.

## 5. UI Architecture

### Layout & Navigation
- **`AdminLayout`**: Persistent sidebar with collapsible navigation.
- **`TopNav` Integration**: Conditional "Admin Panel" link in profile dropdown.
- **`AnnouncementBanner`**: Top-level display in `MainLayout`.

### Admin Pages
- **Dashboard**: Overview of platform health using `StatsCard` and activity charts.
- **User Management**: Table-based interface for user administration.
- **Content Moderation**: Tabbed view for post and comment removal.
- **Categories**: Simple CRUD interface for organizing community content.
- **Announcements**: Form and list management for site-wide messaging.

## 6. Implementation Notes
- **Soft Banning**: The system uses timestamp-based expiration for temporary bans.
- **Real-time Stats**: Metrics are calculated via parallel Supabase queries for the dashboard overview.
- **RPC Usage**: Several backend functions (e.g., `ban_user`) are prepared in SQL but currently accessed via direct queries in the service layer pending TypeScript type regeneration.

## 7. Frontend Ban Enforcement
- **AuthContext** (`src/contexts/AuthContext.tsx`):
    - `BanInfo` interface tracks ban status, reason, expiration, and permanence.
    - `checkBanStatus()` evaluates `is_banned` flag and `ban_expires_at` timestamp.
    - Expired bans automatically return `isBanned: false`.
    - Exposes `isBanned` and `banInfo` to all components via context.
- **ProtectedRoute** (`src/components/auth/ProtectedRoute.tsx`):
    - Checks `isBanned` status after authentication.
    - Redirects banned users to `/banned` route.
- **Banned Page** (`src/pages/auth/Banned.tsx`):
    - Displays ban reason (if provided).
    - Shows expiration date and time remaining for temporary bans.
    - Indicates permanent suspension for indefinite bans.
    - Provides sign-out functionality.

## 8. Categories RLS Policies (Migration 018)
- **Issue**: Platform admins couldn't create global categories (`group_id = NULL`) because existing policies only checked `is_group_admin_or_mod()` which fails for NULL group_id.
- **Solution**: Updated RLS policies to check `is_platform_admin(auth.uid())` first, then fall back to group admin check for group-specific categories.
- **Policies Updated**:
    - `Categories viewable by authenticated users` (SELECT)
    - `Admins can create categories` (INSERT)
    - `Admins can update categories` (UPDATE)
    - `Admins can delete categories` (DELETE)

## 9. Announcements Implementation
- **TypeScript Types** (`src/types/database.ts`):
    - Added `announcements` table type with all fields.
    - Added `announcement_dismissals` junction table type.
    - Added `announcement_type` enum: `'info' | 'warning' | 'success' | 'error'`.
    - Added `announcement_scope` enum: `'global' | 'group'`.
- **Service Functions** (`src/services/admin.ts`):
    - `getAnnouncements()`: Fetches all announcements with creator profile join.
    - `getActiveAnnouncements()`: Filters by `is_active`, date range, and scope.
    - `createAnnouncement()`: Inserts new announcement record.
    - `updateAnnouncement()`: Updates existing announcement by ID.
    - `deleteAnnouncement()`: Removes announcement record.
    - `dismissAnnouncement()`: Records user dismissal in junction table.
    - `getDismissedAnnouncementIds()`: Fetches user's dismissed announcement IDs.
