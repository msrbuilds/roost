# Phase 7: Advanced Features - Technical Specification

**Date:** January 27, 2026  
**Status:** 🚧 Planning  
**Version:** 1.0

---

## Overview

Phase 7 implements three major advanced features for the Commune community platform:

1. **Leaderboard System** - Points calculation, ranking, and gamification
2. **Calendar & Events** - Event creation, management, RSVP system, and calendar views
3. **Members Directory** - Comprehensive member listing with search, filters, and profiles

These features enhance community engagement through gamification, event coordination, and improved member discovery.

---

## Features Overview

### 7.1: Leaderboard System

#### Core Features
- [ ] Points calculation engine with configurable actions
- [ ] Global leaderboard (all-time and 30-day)
- [ ] Group-specific leaderboards
- [ ] User rank badges and achievements
- [ ] Points history and activity tracking
- [ ] Admin controls for manual point adjustments

#### Point Actions
```typescript
const POINT_ACTIONS = {
  POST_CREATED: 10,
  COMMENT_CREATED: 5,
  REACTION_GIVEN: 1,
  REACTION_RECEIVED: 2,
  EVENT_ATTENDED: 15,
  DAILY_LOGIN: 1,
  PROFILE_COMPLETED: 20,
} as const;
```

### 7.2: Calendar & Events

#### Core Features
- [ ] Event creation and editing (admins/moderators)
- [ ] Event detail pages with RSVP
- [ ] Calendar views (Month, Week, Day, List)
- [ ] Event reminders and notifications
- [ ] Virtual event support (meeting URLs)
- [ ] Physical event support (location)
- [ ] Event attendee management
- [ ] iCal export functionality

#### Event Types
- Virtual events (Zoom, Google Meet, etc.)
- Physical events (with location)
- Hybrid events (both virtual and physical)

### 7.3: Members Directory

#### Core Features
- [ ] Paginated member list with infinite scroll
- [ ] Search by name/username
- [ ] Filter by role (admin, moderator, member)
- [ ] Filter by online status
- [ ] Filter by group membership
- [ ] Sort options (newest, alphabetical, most active)
- [ ] Member profile cards with quick actions
- [ ] Direct message initiation from directory
- [ ] Admin/Moderator badges
- [ ] Online status indicators

---

## Database Schema

### Existing Tables (From Migration 001)

The following tables already exist and will be utilized:

#### `leaderboard_entries` Table ✅
```sql
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id, period_start)
);
```

**Indexes:**
- `idx_leaderboard_user` on `user_id`
- `idx_leaderboard_group` on `group_id`
- `idx_leaderboard_points` on `points DESC`
- `idx_leaderboard_period` on `period_start, period_end`

#### `events` Table ✅
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    is_virtual BOOLEAN DEFAULT false,
    meeting_url TEXT,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT event_title_length CHECK (char_length(title) >= 2 AND char_length(title) <= 200),
    CONSTRAINT event_time_check CHECK (end_time > start_time)
);
```

**Indexes:**
- `idx_events_group` on `group_id`
- `idx_events_creator` on `created_by`
- `idx_events_start_time` on `start_time ASC`

#### `event_attendees` Table ✅
```sql
CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'not_going');

CREATE TABLE event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status rsvp_status DEFAULT 'going',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);
```

**Indexes:**
- `idx_event_attendees_event` on `event_id`
- `idx_event_attendees_user` on `user_id`
- `idx_event_attendees_status` on `status`

### New Tables & Migrations

#### Migration 008: Point Activities Table

**File:** `migrations/008_point_activities.sql`

Track all point-earning activities for transparency and history.

```sql
CREATE TYPE point_action_type AS ENUM (
    'post_created',
    'comment_created',
    'reaction_given',
    'reaction_received',
    'event_attended',
    'daily_login',
    'profile_completed',
    'manual_adjustment'
);

CREATE TABLE point_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    action_type point_action_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    reference_id UUID, -- Related entity (post_id, comment_id, event_id, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_activities_user ON point_activities(user_id);
CREATE INDEX idx_point_activities_group ON point_activities(group_id);
CREATE INDEX idx_point_activities_action ON point_activities(action_type);
CREATE INDEX idx_point_activities_created ON point_activities(created_at DESC);
```

#### Migration 009: Event Enhancements

**File:** `migrations/009_event_enhancements.sql`

Add additional fields for better event management.

```sql
-- Add cover image for events
ALTER TABLE events ADD COLUMN cover_url TEXT;

-- Add max attendees limit
ALTER TABLE events ADD COLUMN max_attendees INTEGER;

-- Add event type field
CREATE TYPE event_type AS ENUM ('virtual', 'physical', 'hybrid');
ALTER TABLE events ADD COLUMN event_type event_type DEFAULT 'virtual';

-- Add timezone field
ALTER TABLE events ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Add recurring event support (for future)
ALTER TABLE events ADD COLUMN is_recurring BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN recurrence_rule TEXT; -- iCal RRULE format

COMMENT ON COLUMN events.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN events.recurrence_rule IS 'iCal RRULE format for recurring events';
```

#### Migration 010: Leaderboard Functions

**File:** `migrations/010_leaderboard_functions.sql`

Database functions for efficient leaderboard calculations.

```sql
-- Function to calculate user's total points for a period
CREATE OR REPLACE FUNCTION calculate_user_points(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER;
BEGIN
    SELECT COALESCE(SUM(points), 0)
    INTO total_points
    FROM point_activities
    WHERE user_id = p_user_id
        AND (p_group_id IS NULL OR group_id = p_group_id)
        AND created_at >= p_start_date
        AND created_at <= p_end_date;
    
    RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard entry
CREATE OR REPLACE FUNCTION update_leaderboard_entry(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
    p_period_end DATE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
)
RETURNS void AS $$
DECLARE
    v_points INTEGER;
BEGIN
    -- Calculate points for the period
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);
    
    -- Insert or update leaderboard entry
    INSERT INTO leaderboard_entries (user_id, group_id, points, period_start, period_end)
    VALUES (p_user_id, p_group_id, v_points, p_period_start, p_period_end)
    ON CONFLICT (user_id, group_id, period_start)
    DO UPDATE SET 
        points = v_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to award points
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_action_type point_action_type,
    p_points INTEGER,
    p_group_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    -- Insert point activity
    INSERT INTO point_activities (
        user_id,
        group_id,
        action_type,
        points,
        description,
        reference_id
    )
    VALUES (
        p_user_id,
        p_group_id,
        p_action_type,
        p_points,
        p_description,
        p_reference_id
    )
    RETURNING id INTO v_activity_id;
    
    -- Update 30-day leaderboard
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE
    );
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;
```

#### Migration 011: Database Triggers for Points

**File:** `migrations/011_point_triggers.sql`

Automatic point awarding via database triggers.

```sql
-- Trigger: Award points for new posts
CREATE OR REPLACE FUNCTION trigger_post_points()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_points(
        NEW.author_id,
        'post_created',
        10,
        NEW.group_id,
        'Created a new post',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_points_for_post
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_post_points();

-- Trigger: Award points for new comments
CREATE OR REPLACE FUNCTION trigger_comment_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Get group_id from the post
    SELECT group_id INTO v_group_id
    FROM posts
    WHERE id = NEW.post_id;
    
    PERFORM award_points(
        NEW.author_id,
        'comment_created',
        5,
        v_group_id,
        'Created a new comment',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_points_for_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_comment_points();

-- Trigger: Award points for reactions received
CREATE OR REPLACE FUNCTION trigger_reaction_points()
RETURNS TRIGGER AS $$
DECLARE
    v_content_author_id UUID;
    v_group_id UUID;
BEGIN
    -- Get the author of the content that received the reaction
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id, group_id INTO v_content_author_id, v_group_id
        FROM posts WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT c.author_id, p.group_id INTO v_content_author_id, v_group_id
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        WHERE c.id = NEW.reactable_id;
    END IF;
    
    -- Award points to reaction giver (1 point)
    PERFORM award_points(
        NEW.user_id,
        'reaction_given',
        1,
        v_group_id,
        'Gave a reaction',
        NEW.id
    );
    
    -- Award points to content author (2 points)
    IF v_content_author_id IS NOT NULL THEN
        PERFORM award_points(
            v_content_author_id,
            'reaction_received',
            2,
            v_group_id,
            'Received a reaction',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_points_for_reaction
    AFTER INSERT ON reactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reaction_points();

-- Trigger: Award points for event attendance
CREATE OR REPLACE FUNCTION trigger_event_attendance_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Only award points for 'going' status
    IF NEW.status = 'going' THEN
        SELECT group_id INTO v_group_id
        FROM events WHERE id = NEW.event_id;
        
        PERFORM award_points(
            NEW.user_id,
            'event_attended',
            15,
            v_group_id,
            'RSVP''d to an event',
            NEW.event_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_points_for_event_attendance
    AFTER INSERT ON event_attendees
    FOR EACH ROW
    EXECUTE FUNCTION trigger_event_attendance_points();
```

### Row Level Security (RLS)

#### Point Activities Policies

```sql
-- Users can view their own point activities
CREATE POLICY "Users can view own point activities"
    ON point_activities FOR SELECT
    USING (user_id = auth.uid());

-- Users can view point activities in groups they're members of
CREATE POLICY "Group members can view group point activities"
    ON point_activities FOR SELECT
    USING (
        group_id IS NOT NULL 
        AND is_group_member(group_id, auth.uid())
    );

-- Only admins can insert manual adjustments
CREATE POLICY "Admins can create manual point adjustments"
    ON point_activities FOR INSERT
    WITH CHECK (
        action_type = 'manual_adjustment'
        AND is_platform_admin(auth.uid())
    );
```

#### Events Policies

```sql
-- Anyone can view public group events
CREATE POLICY "Members can view group events"
    ON events FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Admins/moderators can create events
CREATE POLICY "Group admins can create events"
    ON events FOR INSERT
    WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()));

-- Admins/moderators can update their group's events
CREATE POLICY "Group admins can update events"
    ON events FOR UPDATE
    USING (is_group_admin_or_mod(group_id, auth.uid()));

-- Admins/moderators can delete their group's events
CREATE POLICY "Group admins can delete events"
    ON events FOR DELETE
    USING (is_group_admin_or_mod(group_id, auth.uid()));
```

#### Event Attendees Policies

```sql
-- Members can view attendees of events they have access to
CREATE POLICY "Members can view event attendees"
    ON event_attendees FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_id
            AND is_group_member(e.group_id, auth.uid())
        )
    );

-- Members can RSVP to events
CREATE POLICY "Members can RSVP to events"
    ON event_attendees FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_id
            AND is_group_member(e.group_id, auth.uid())
        )
    );

-- Users can update their own RSVP
CREATE POLICY "Users can update own RSVP"
    ON event_attendees FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own RSVP
CREATE POLICY "Users can delete own RSVP"
    ON event_attendees FOR DELETE
    USING (user_id = auth.uid());
```

#### Leaderboard Entries Policies

```sql
-- Anyone can view global leaderboard
CREATE POLICY "Anyone can view global leaderboard"
    ON leaderboard_entries FOR SELECT
    USING (group_id IS NULL);

-- Group members can view group leaderboard
CREATE POLICY "Group members can view group leaderboard"
    ON leaderboard_entries FOR SELECT
    USING (
        group_id IS NOT NULL
        AND is_group_member(group_id, auth.uid())
    );

-- Only system functions can insert/update leaderboard entries
-- (No direct INSERT/UPDATE policies for users)
```

---

## Service Layer

### File: `src/services/leaderboard.ts` (NEW)

```typescript
import { supabase } from './supabase';
import type { LeaderboardEntry, PointActivity, LeaderboardRank } from '../types';

/**
 * Get global leaderboard for a time period
 */
export async function getGlobalLeaderboard(
  periodDays: number = 30,
  limit: number = 100
): Promise<LeaderboardRank[]> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select(`
      *,
      user:profiles!user_id (
        id,
        username,
        display_name,
        avatar_url,
        location
      )
    `)
    .is('group_id', null)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .order('points', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Add rank numbers
  return (data || []).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Get group-specific leaderboard
 */
export async function getGroupLeaderboard(
  groupId: string,
  periodDays: number = 30,
  limit: number = 100
): Promise<LeaderboardRank[]> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select(`
      *,
      user:profiles!user_id (
        id,
        username,
        display_name,
        avatar_url,
        location
      )
    `)
    .eq('group_id', groupId)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .order('points', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Get user's leaderboard rank
 */
export async function getUserRank(
  userId: string,
  groupId?: string,
  periodDays: number = 30
): Promise<{ rank: number; points: number; totalUsers: number } | null> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Get all entries for ranking
  const query = supabase
    .from('leaderboard_entries')
    .select('user_id, points')
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .order('points', { ascending: false });

  if (groupId) {
    query.eq('group_id', groupId);
  } else {
    query.is('group_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const userEntry = data?.find((entry) => entry.user_id === userId);
  if (!userEntry) return null;

  const rank = data.findIndex((entry) => entry.user_id === userId) + 1;

  return {
    rank,
    points: userEntry.points,
    totalUsers: data.length,
  };
}

/**
 * Get user's point activity history
 */
export async function getUserPointActivities(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<PointActivity[]> {
  const { data, error } = await supabase
    .from('point_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

/**
 * Manual point adjustment (admin only)
 */
export async function adjustUserPoints(
  userId: string,
  points: number,
  description: string,
  groupId?: string
): Promise<void> {
  const { error } = await supabase.rpc('award_points', {
    p_user_id: userId,
    p_action_type: 'manual_adjustment',
    p_points: points,
    p_group_id: groupId || null,
    p_description: description,
    p_reference_id: null,
  });

  if (error) throw error;
}

/**
 * Get leaderboard statistics
 */
export async function getLeaderboardStats(groupId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const query = supabase
    .from('leaderboard_entries')
    .select('points')
    .gte('period_start', thirtyDaysAgo.toISOString().split('T')[0]);

  if (groupId) {
    query.eq('group_id', groupId);
  } else {
    query.is('group_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const points = data?.map((e) => e.points) || [];
  const totalPoints = points.reduce((sum, p) => sum + p, 0);
  const avgPoints = points.length > 0 ? totalPoints / points.length : 0;
  const maxPoints = Math.max(...points, 0);

  return {
    totalUsers: points.length,
    totalPoints,
    averagePoints: Math.round(avgPoints),
    highestPoints: maxPoints,
  };
}
```

### File: `src/services/event.ts` (NEW)

```typescript
import { supabase } from './supabase';
import type { Event, EventAttendee, EventWithDetails, RSVPStatus } from '../types';

/**
 * Get all events for a group
 */
export async function getGroupEvents(
  groupId: string,
  startDate?: Date,
  endDate?: Date
): Promise<EventWithDetails[]> {
  let query = supabase
    .from('events')
    .select(`
      *,
      creator:profiles!created_by (
        id,
        username,
        display_name,
        avatar_url
      ),
      attendee_count:event_attendees(count)
    `)
    .eq('group_id', groupId)
    .order('start_time', { ascending: true });

  if (startDate) {
    query = query.gte('start_time', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('end_time', endDate.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

/**
 * Get upcoming events across all groups user is a member of
 */
export async function getUpcomingEvents(
  userId: string,
  limit: number = 10
): Promise<EventWithDetails[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      group:groups!group_id (
        id,
        name,
        slug,
        avatar_url
      ),
      creator:profiles!created_by (
        id,
        username,
        display_name,
        avatar_url
      ),
      attendee_count:event_attendees(count)
    `)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get single event by ID
 */
export async function getEventById(eventId: string): Promise<EventWithDetails | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      group:groups!group_id (
        id,
        name,
        slug,
        avatar_url
      ),
      creator:profiles!created_by (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new event
 */
export async function createEvent(event: {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_virtual: boolean;
  meeting_url?: string;
  event_type: 'virtual' | 'physical' | 'hybrid';
  timezone: string;
  max_attendees?: number;
  cover_url?: string;
  group_id: string;
  created_by: string;
}): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an event
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<Event>
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

/**
 * Get event attendees
 */
export async function getEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`
      *,
      user:profiles!user_id (
        id,
        username,
        display_name,
        avatar_url,
        is_online
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * RSVP to an event
 */
export async function rsvpToEvent(
  eventId: string,
  userId: string,
  status: RSVPStatus
): Promise<EventAttendee> {
  const { data, error } = await supabase
    .from('event_attendees')
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        status,
      },
      {
        onConflict: 'event_id,user_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove RSVP from an event
 */
export async function removeRSVP(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get user's RSVP status for an event
 */
export async function getUserRSVP(
  eventId: string,
  userId: string
): Promise<EventAttendee | null> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get events user has RSVP'd to
 */
export async function getUserEvents(userId: string): Promise<EventWithDetails[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`
      *,
      event:events!event_id (
        *,
        group:groups!group_id (
          id,
          name,
          slug,
          avatar_url
        ),
        creator:profiles!created_by (
          id,
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'going')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map((item) => item.event) || [];
}
```

### File: `src/services/member.ts` (NEW)

```typescript
import { supabase } from './supabase';
import type { Profile, GroupRole } from '../types';

export interface MemberFilters {
  search?: string;
  role?: GroupRole;
  isOnline?: boolean;
  groupId?: string;
}

export interface MemberWithRole extends Profile {
  role?: GroupRole;
  joined_at?: string;
  member_count?: number; // For stats
}

/**
 * Get all members with filters
 */
export async function getMembers(
  filters: MemberFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<MemberWithRole[]> {
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  // Text search (username or display_name)
  if (filters.search) {
    query = query.or(
      `username.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`
    );
  }

  // Online status filter
  if (filters.isOnline !== undefined) {
    query = query.eq('is_online', filters.isOnline);
  }

  // Default ordering
  query = query.order('created_at', { ascending: false });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

/**
 * Get members of a specific group with role information
 */
export async function getGroupMembers(
  groupId: string,
  filters: Omit<MemberFilters, 'groupId'> = {},
  limit: number = 50,
  offset: number = 0
): Promise<MemberWithRole[]> {
  let query = supabase
    .from('group_members')
    .select(`
      role,
      joined_at,
      user:profiles!user_id (*)
    `)
    .eq('group_id', groupId);

  // Role filter
  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  // Online status filter
  if (filters.isOnline !== undefined) {
    query = query.eq('user.is_online', filters.isOnline);
  }

  // Default ordering
  query = query.order('joined_at', { ascending: false });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  // Flatten structure and apply search filter on client side if needed
  let members = (data || []).map((item: any) => ({
    ...item.user,
    role: item.role,
    joined_at: item.joined_at,
  }));

  // Client-side search filter (since we can't do OR on nested fields easily)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    members = members.filter(
      (m) =>
        m.username?.toLowerCase().includes(searchLower) ||
        m.display_name?.toLowerCase().includes(searchLower)
    );
  }

  return members;
}

/**
 * Get member statistics
 */
export async function getMemberStats(groupId?: string) {
  let query = supabase.from('profiles').select('is_online', { count: 'exact', head: true });

  if (groupId) {
    // Get stats for group members only
    const { data: memberIds } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (memberIds && memberIds.length > 0) {
      const ids = memberIds.map((m) => m.user_id);
      query = query.in('id', ids);
    } else {
      return { total: 0, online: 0 };
    }
  }

  const [totalResult, onlineResult] = await Promise.all([
    query,
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true),
  ]);

  return {
    total: totalResult.count || 0,
    online: onlineResult.count || 0,
  };
}

/**
 * Search members across platform
 */
export async function searchMembers(
  query: string,
  limit: number = 20
): Promise<Profile[]> {
  if (query.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_online, location')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get admins and moderators
 */
export async function getGroupStaff(groupId: string): Promise<MemberWithRole[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      joined_at,
      user:profiles!user_id (*)
    `)
    .eq('group_id', groupId)
    .in('role', ['admin', 'moderator'])
    .order('role', { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item.user,
    role: item.role,
    joined_at: item.joined_at,
  }));
}
```

---

## Component Architecture

### Leaderboard Components

**Directory:** `src/components/leaderboard/`

#### 1. `LeaderboardCard.tsx`
Compact leaderboard widget for sidebar/dashboard.

**Props:**
```typescript
interface LeaderboardCardProps {
  groupId?: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  limit?: number;
}
```

**Features:**
- Top N users (default 10)
- User rank display with avatar
- Points display
- Link to full leaderboard page

#### 2. `LeaderboardTable.tsx`
Full leaderboard table with pagination.

**Props:**
```typescript
interface LeaderboardTableProps {
  groupId?: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  currentUserId?: string;
}
```

**Features:**
- Rank, Avatar, Name, Points columns
- Highlight current user row
- Medal icons for top 3 (🥇🥈🥉)
- Infinite scroll pagination
- Loading states

#### 3. `PointActivityFeed.tsx`
Display user's point earning history.

**Props:**
```typescript
interface PointActivityFeedProps {
  userId: string;
  limit?: number;
}
```

**Features:**
- Activity type icons
- Point amount (+ or -)
- Timestamp
- Description
- Link to reference (post, comment, etc.)

#### 4. `UserRankBadge.tsx`
Reusable badge component showing user rank.

**Props:**
```typescript
interface UserRankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
}
```

### Calendar & Events Components

**Directory:** `src/components/events/`

#### 1. `CalendarView.tsx`
Main calendar component with month/week/day views.

**Props:**
```typescript
interface CalendarViewProps {
  groupId?: string;
  initialView?: 'month' | 'week' | 'day' | 'list';
  onEventClick?: (eventId: string) => void;
}
```

**Features:**
- Month grid view (react-big-calendar or custom)
- Week view with time slots
- Day view with hourly breakdown
- List view (upcoming events)
- View switcher
- Navigation (prev/next month)
- Today button
- Event color coding by group

#### 2. `EventCard.tsx`
Preview card for events in lists.

**Props:**
```typescript
interface EventCardProps {
  event: EventWithDetails;
  showGroup?: boolean;
  compact?: boolean;
}
```

**Features:**
- Event cover image
- Title and description preview
- Date/time display with relative formatting
- Location/virtual badge
- Attendee count
- RSVP button
- Group info (if cross-group view)

#### 3. `CreateEventModal.tsx`
Event creation/editing form.

**Props:**
```typescript
interface CreateEventModalProps {
  isOpen: boolean;
  groupId: string;
  eventToEdit?: Event;
  onClose: () => void;
  onSuccess: (event: Event) => void;
}
```

**Form Fields:**
- Title (required)
- Description (rich text)
- Start date/time (datetime-local)
- End date/time (datetime-local)
- Timezone selector
- Event type (virtual/physical/hybrid)
- Location (for physical/hybrid)
- Meeting URL (for virtual/hybrid)
- Max attendees (optional)
- Cover image upload

#### 4. `EventDetailModal.tsx`
Full event details with RSVP.

**Props:**
```typescript
interface EventDetailModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
- Cover image
- Title, description (full)
- Date/time with timezone
- Location/meeting link
- Attendee list with avatars
- RSVP buttons (Going/Maybe/Not Going)
- Current user's RSVP status
- Edit/Delete buttons (creator only)
- Add to calendar (iCal export)
- Share button

#### 5. `EventAttendeesList.tsx`
List of event attendees with status.

**Props:**
```typescript
interface EventAttendeesListProps {
  eventId: string;
  maxDisplay?: number;
}
```

**Features:**
- Avatar stack (first N users)
- Grouped by status (Going, Maybe, Not Going)
- Total count
- Expandable full list modal

#### 6. `UpcomingEvents.tsx`
Widget showing upcoming events.

**Props:**
```typescript
interface UpcomingEventsProps {
  groupId?: string;
  userId?: string;
  limit?: number;
}
```

**Features:**
- Compact event cards
- "Your Events" vs "All Events" tabs
- Link to full calendar

### Members Directory Components

**Directory:** `src/components/members/`

#### 1. `MemberCard.tsx`
Member preview card.

**Props:**
```typescript
interface MemberCardProps {
  member: MemberWithRole;
  showRole?: boolean;
  showActions?: boolean;
}
```

**Features:**
- Avatar with online indicator
- Username and display name
- Role badge (admin/moderator)
- Location
- Quick actions (Message, View Profile)
- Member since date

#### 2. `MemberList.tsx`
Paginated member list.

**Props:**
```typescript
interface MemberListProps {
  groupId?: string;
  filters: MemberFilters;
  onFilterChange: (filters: MemberFilters) => void;
}
```

**Features:**
- Grid layout (responsive)
- Infinite scroll
- Loading skeletons
- Empty state
- Member count display

#### 3. `MemberFilters.tsx`
Filter controls for member directory.

**Props:**
```typescript
interface MemberFiltersProps {
  filters: MemberFilters;
  onChange: (filters: MemberFilters) => void;
  showRoleFilter?: boolean;
}
```

**Features:**
- Search input (debounced)
- Role filter (admin/moderator/member)
- Online status toggle
- Sort options (newest, alphabetical, most active)
- Clear filters button

#### 4. `MemberStats.tsx`
Member statistics widget.

**Props:**
```typescript
interface MemberStatsProps {
  groupId?: string;
}
```

**Features:**
- Total members count
- Online members count
- New members (this week)
- Growth percentage

---

## Page Implementation

### New Pages

#### 1. `src/pages/Leaderboard.tsx`
Full leaderboard page with tabs.

**Route:** `/leaderboard` (global) or `/groups/:slug/leaderboard` (group)

**Features:**
- Period selector (7 days, 30 days, all-time)
- Global vs Group toggle
- LeaderboardTable component
- Current user's rank card
- Point earning guide section

#### 2. `src/pages/Calendar.tsx`
Calendar and events page.

**Route:** `/calendar` (all events) or `/groups/:slug/calendar` (group)

**Features:**
- CalendarView component
- View switcher (month/week/day/list)
- Create Event button (admins only)
- Filter by group dropdown
- Upcoming events sidebar

#### 3. `src/pages/EventDetail.tsx`
Individual event page.

**Route:** `/events/:id`

**Features:**
- Full event details
- RSVP functionality
- Attendees list
- Comments section (reuse PostComments)
- Social sharing

#### 4. `src/pages/Members.tsx`
Members directory page.

**Route:** `/members` (all) or `/groups/:slug/members` (group)

**Features:**
- MemberFilters component
- MemberList component
- MemberStats component
- Search functionality
- Responsive grid layout

### Updated Pages

#### `src/pages/Home.tsx`
Add widgets to dashboard:
- `LeaderboardCard` (top 5 users)
- `UpcomingEvents` (next 3 events)
- Member stats

#### `src/pages/Profile.tsx`
Add user stats section:
- Total points
- Current rank
- Badge display
- Point activity feed
- Events attended

#### `src/pages/GroupDetail.tsx`
Add new tabs:
- Events tab (group calendar)
- Leaderboard tab (group rankings)

---

## Type Definitions

### New Types

**File:** `src/types/index.ts`

```typescript
// Leaderboard Types
export interface LeaderboardEntry {
  id: string;
  user_id: string;
  group_id: string | null;
  points: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardRank extends LeaderboardEntry {
  rank: number;
  user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'location'>;
}

export type PointActionType =
  | 'post_created'
  | 'comment_created'
  | 'reaction_given'
  | 'reaction_received'
  | 'event_attended'
  | 'daily_login'
  | 'profile_completed'
  | 'manual_adjustment';

export interface PointActivity {
  id: string;
  user_id: string;
  group_id: string | null;
  action_type: PointActionType;
  points: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

// Event Types
export type EventType = 'virtual' | 'physical' | 'hybrid';
export type RSVPStatus = 'going' | 'maybe' | 'not_going';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  is_virtual: boolean;
  meeting_url: string | null;
  event_type: EventType;
  timezone: string;
  max_attendees: number | null;
  cover_url: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  group_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventWithDetails extends Event {
  group?: Pick<Group, 'id' | 'name' | 'slug' | 'avatar_url'>;
  creator?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  attendee_count?: number;
  user_rsvp?: RSVPStatus;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: RSVPStatus;
  created_at: string;
  updated_at: string;
  user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>;
}

// Member Types (extend existing Profile)
export interface MemberWithRole extends Profile {
  role?: GroupRole;
  joined_at?: string;
}
```

---

## Real-time Features

### Pattern 1: Leaderboard Updates
```typescript
// Subscribe to point activity changes
const channel = supabase
  .channel('leaderboard-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'point_activities',
  }, async () => {
    // Refresh leaderboard when points change
    await fetchLeaderboard();
  })
  .subscribe();
```

### Pattern 2: Event Updates
```typescript
// Subscribe to event changes for a group
const channel = supabase
  .channel(`group-events-${groupId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'events',
    filter: `group_id=eq.${groupId}`,
  }, async (payload) => {
    // Update event list
    handleEventChange(payload);
  })
  .subscribe();
```

### Pattern 3: RSVP Updates
```typescript
// Subscribe to attendee changes for an event
const channel = supabase
  .channel(`event-attendees-${eventId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'event_attendees',
    filter: `event_id=eq.${eventId}`,
  }, async () => {
    // Refresh attendee list and count
    await fetchAttendees();
  })
  .subscribe();
```

---

## Navigation Updates

### TopNav Component

Add new navigation items:

```typescript
const navItems = [
  { label: 'Community', path: '/', icon: Home },
  { label: 'Groups', path: '/groups', icon: Users },
  { label: 'Calendar', path: '/calendar', icon: Calendar }, // NEW
  { label: 'Members', path: '/members', icon: UsersIcon }, // NEW
  { label: 'Leaderboard', path: '/leaderboard', icon: Trophy }, // NEW
  { label: 'About', path: '/about', icon: Info },
];
```

### Routing Configuration

**File:** `src/App.tsx`

```typescript
// New routes
<Route path="/calendar" element={<Calendar />} />
<Route path="/events/:id" element={<EventDetail />} />
<Route path="/leaderboard" element={<Leaderboard />} />
<Route path="/members" element={<Members />} />
<Route path="/groups/:slug/calendar" element={<Calendar />} />
<Route path="/groups/:slug/leaderboard" element={<Leaderboard />} />
<Route path="/groups/:slug/members" element={<Members />} />
```

---

## Testing & Verification

### Manual Testing Checklist

#### Leaderboard System
- [ ] Create posts, comments, reactions and verify points are awarded
- [ ] Check global leaderboard displays correct rankings
- [ ] Check group leaderboard displays correct rankings
- [ ] Verify user can see their own rank
- [ ] Test point activity feed shows all actions
- [ ] Verify admin can manually adjust points
- [ ] Test leaderboard updates in real-time

#### Calendar & Events
- [ ] Create a virtual event with meeting URL
- [ ] Create a physical event with location
- [ ] Create a hybrid event with both
- [ ] RSVP to an event as "Going"
- [ ] Change RSVP to "Maybe"
- [ ] Remove RSVP
- [ ] Verify attendee count updates
- [ ] Test event editing (creator only)
- [ ] Test event deletion (creator only)
- [ ] Verify event appears in calendar view
- [ ] Test month/week/day view switching
- [ ] Verify timezone displays correctly
- [ ] Test event notifications

#### Members Directory
- [ ] Search for members by username
- [ ] Search for members by display name
- [ ] Filter by online status
- [ ] Filter by role (in group context)
- [ ] Sort by newest members
- [ ] Sort alphabetically
- [ ] Verify pagination works
- [ ] Test "Message" action from member card
- [ ] Verify admin/moderator badges display
- [ ] Test online indicator updates in real-time

### Automated Testing

#### Unit Tests
```bash
# Test service functions
npm test src/services/leaderboard.test.ts
npm test src/services/event.test.ts
npm test src/services/member.test.ts
```

#### Integration Tests
```bash
# Test point awarding flow
npm test src/__tests__/points-integration.test.ts

# Test event RSVP flow
npm test src/__tests__/event-rsvp.test.ts

# Test member search
npm test src/__tests__/member-search.test.ts
```

### Database Migration Testing

1. Run migrations in order:
   ```sql
   -- 008: Point activities
   -- 009: Event enhancements
   -- 010: Leaderboard functions
   -- 011: Point triggers
   ```

2. Verify triggers work:
   ```sql
   -- Insert test post
   INSERT INTO posts (title, content, author_id, group_id)
   VALUES ('Test', 'Content', <user_id>, <group_id>);
   
   -- Check point_activities table
   SELECT * FROM point_activities 
   WHERE user_id = <user_id> 
   ORDER BY created_at DESC;
   
   -- Check leaderboard_entries table
   SELECT * FROM leaderboard_entries
   WHERE user_id = <user_id>;
   ```

3. Test RLS policies:
   ```sql
   -- Switch to authenticated user context
   SET ROLE authenticated;
   SET request.jwt.claim.sub = '<user_id>';
   
   -- Verify user can view their points
   SELECT * FROM point_activities WHERE user_id = '<user_id>';
   
   -- Verify user cannot insert manual adjustments
   INSERT INTO point_activities (user_id, action_type, points)
   VALUES ('<user_id>', 'manual_adjustment', 100);
   -- Should fail
   ```

### Performance Testing

- [ ] Test leaderboard query performance with 1000+ users
- [ ] Test calendar rendering with 100+ events
- [ ] Test member directory with 500+ members
- [ ] Verify infinite scroll doesn't cause memory leaks
- [ ] Check real-time subscription performance

---

## Migration Plan

### Step 1: Database Setup (Week 1, Day 1-2)
1. Run migration 008 (point_activities table)
2. Run migration 009 (event enhancements)
3. Run migration 010 (leaderboard functions)
4. Run migration 011 (point triggers)
5. Verify all migrations successful
6. Test database functions manually

### Step 2: Service Layer (Week 1, Day 3-4)
1. Create `leaderboard.ts` service
2. Create `event.ts` service
3. Create `member.ts` service
4. Add type definitions
5. Write unit tests for services

### Step 3: Component Development (Week 1, Day 5 - Week 2, Day 3)

**Leaderboard (2 days):**
1. `LeaderboardCard.tsx`
2. `LeaderboardTable.tsx`
3. `PointActivityFeed.tsx`
4. `UserRankBadge.tsx`

**Events (3 days):**
1. `CalendarView.tsx` (most complex)
2. `EventCard.tsx`
3. `CreateEventModal.tsx`
4. `EventDetailModal.tsx`
5. `EventAttendeesList.tsx`
6. `UpcomingEvents.tsx`

**Members (2 days):**
1. `MemberCard.tsx`
2. `MemberList.tsx`
3. `MemberFilters.tsx`
4. `MemberStats.tsx`

### Step 4: Page Implementation (Week 2, Day 4-5)
1. `Leaderboard.tsx` page
2. `Calendar.tsx` page
3. `EventDetail.tsx` page
4. `Members.tsx` page
5. Update routing in `App.tsx`
6. Update navigation in `TopNav.tsx`

### Step 5: Integration & Testing (Week 2, Day 6-7)
1. Integration testing
2. Manual testing all flows
3. Performance optimization
4. Bug fixes
5. Documentation updates

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "react-big-calendar": "^1.8.5",
    "date-fns": "^3.0.0",
    "date-fns-tz": "^2.0.0"
  },
  "devDependencies": {
    "@types/react-big-calendar": "^1.8.5"
  }
}
```

**Note:** `react-big-calendar` is optional. Can build custom calendar component instead.

---

## Known Limitations & Future Enhancements

### Current Limitations
- No recurring events (data structure ready, UI not implemented)
- No iCal import
- No event reminders (infrastructure ready via notifications)
- No leaderboard seasons/reset
- No badge/achievement system (points only)

### Future Enhancements (Phase 8+)
- Recurring events with RRULE support
- Email event reminders
- Push notifications for events
- Badge achievement system
- Leaderboard seasons with prizes
- Member activity charts
- Advanced member filtering
- CSV export of member lists
- Event capacity management
- Waitlist for full events
- Event comments and discussions

---

## Success Metrics

- [ ] Users can see leaderboard and their rank
- [ ] Points awarded automatically for all actions
- [ ] Events can be created and managed
- [ ] Users can RSVP to events
- [ ] Calendar displays all events correctly
- [ ] Members directory with working search
- [ ] All real-time updates working
- [ ] Mobile responsive design
- [ ] Page load times < 2 seconds
- [ ] No critical bugs

---

## Conclusion

Phase 7 adds essential community engagement features through gamification (leaderboards), event coordination (calendar), and improved member discovery (directory). The database schema is already in place, requiring only enhancements for better functionality. The implementation follows established patterns from Phases 5 and 6, ensuring consistency and maintainability.

**Estimated Timeline:** 2 weeks (7-8 working days)  
**Next Phase:** Phase 8 - Admin Dashboard and Analytics
