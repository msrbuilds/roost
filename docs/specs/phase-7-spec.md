# Phase 7: Advanced Features Specification

## 1. Leaderboard System (Phase 7.1)

### Overview
A gamification system to drive user engagement through point accumulation and ranking.

### Database Schema
- **`point_activities` Table**: Tracks every point-awarding action.
  - `id`: UUID
  - `user_id`: UUID (FK to profiles)
  - `points`: Integer
  - `activity_type`: Enum (post_create, comment_create, reaction_create, event_attend)
  - `reference_id`: UUID (FK to source content)
  - `created_at`: Timestamp

- **`leaderboard_entries` Table** (Materialized View Concept):
  - Managed via triggers updating a dedicated table for performance.
  - `user_id`: UUID (PK)
  - `total_points`: Integer
  - `monthly_points`: Integer (Reset monthly via cron/scheduled job)
  - `rank`: Integer (Calculated)
  - `updated_at`: Timestamp

### Point Values
- **Create Post**: 10 points
- **Create Comment**: 5 points
- **Receive Reaction**: 1 point
- **Receive Comment**: 2 points
- **Attend Event**: 15 points

### Key Functions (SQL)
- `calculate_user_points(user_id)`: Aggregates points from activities.
- `award_points(user_id, amount, type, ref_id)`: Inserts activity and updates leaderboard.
- `update_leaderboard_entry()`: Trigger function to keep leaderboard sync.

### UI Components
- **`LeaderboardCard`**: Dashboard widget showing top 5 users.
- **`LeaderboardTable`**: Full page table with sorting/filtering.
- **`UserRankBadge`**: Visual badge next to usernames (Bronze/Silver/Gold/Platinum/Diamond).

---

## 2. Calendar & Events (Phase 7.2)

### Overview
A robust event management system supporting both community-wide and group-specific events with RSVP functionality.

### Database Schema
- **`events` Table**:
  - `id`: UUID
  - `title`: String
  - `description`: Text
  - `start_time`: Timestamp
  - `end_time`: Timestamp
  - `is_virtual`: Boolean
  - `meeting_url`: String (Optional)
  - `location`: String (Optional)
  - `created_by`: UUID (FK to profiles)
  - `group_id`: UUID (Nullable - NULL for Community Events)

- **`event_attendees` Table**:
  - `event_id`: UUID
  - `user_id`: UUID
  - `status`: Enum ('going', 'maybe', 'not_going')
  - `created_at`: Timestamp

### RLS Policies
- **Events**:
  - `SELECT`: Viewable by everyone (community) or group members (group).
  - `INSERT`: Auth users can create. Group events require group membership.
  - `UPDATE/DELETE`: Creator or Group Admin/Mod.
- **Attendees**:
  - `SELECT`: Viewable by everyone/group members.
  - `INSERT`: Auth users can RSVP if they have access to the event.

### Features
- **Calendar View**: `react-big-calendar` integration.
- **Contextual Creation**: Clicking a date slot pre-fills the form date.
- **Group Filtering**: Dropdown to filter events by user's groups.
- **Group Selection**: Dropdown in creation form to assign events to groups.
- **RSVP**: Real-time attendee tracking.

---

## 3. Members Directory (Phase 7.3)

### Overview
A centralized directory for discovering and connecting with community members.

### Features
- **Search**: Real-time full-text search by name or username.
- **Filtering**:
  - Status: Online / All
  - Sort: Newest / Recently Active / Alphabetical
- **Infinite Scroll**: Performance optimization for large user bases.
- **Profile Cards**: Quick summary of user bio and stats.

### Service Layer
- `searchMembers(options)`: Sophisticated Supabase query with filtering and pagination.

---

## Migration History (Phase 7)
- `008_point_system.sql`: Initial point tables.
- `010_leaderboard_functions.sql`: Calculation logic.
- `011_point_triggers.sql`: Automation triggers.
- `015_fix_events_rls_null_group.sql`: Enabled community events.
- `016_fix_event_attendees_rls.sql`: Fixed RSVP permissions for community events.
