# 🔧 Complete Fix for Post Creation Error

## Issue
Post creation fails with 404 error due to:
1. ❌ RLS policies blocking NULL group_id
2. ❌ Type casting in leaderboard functions
3. ❌ Trigger function parameter mismatch

## Solution: Run 3 Migrations in Order

### Step 1: Fix RLS Policies
**File:** `migrations/012_fix_posts_rls_null_group.sql`
- Allows posts with NULL group_id (general feed)
- Updates all 4 posts RLS policies

### Step 2: Fix Type Casting
**File:** `migrations/013_fix_leaderboard_type_casting.sql`
- Fixes INTERVAL to DATE casting in award_points function

### Step 3: Recreate Triggers
**File:** `migrations/014_recreate_all_triggers.sql`
- Drops and recreates all point triggers
- Uses named parameters for clarity

## How to Apply (Supabase Dashboard)

1. Go to: https://app.supabase.com/project/njyxywmjdbdzucbdwuum/sql
2. Click "New Query"
3. Copy/paste migration 012, click "Run" ✅
4. Click "New Query" again
5. Copy/paste migration 013, click "Run" ✅
6. Click "New Query" again
7. Copy/paste migration 014, click "Run" ✅
8. Hard refresh your app (Ctrl+Shift+R)
9. Try creating a post - should work! 🎉

## What Each Fix Does

**Migration 012**: Updates posts RLS to allow:
```sql
group_id IS NULL  -- General feed posts
OR is_group_member(group_id, auth.uid())  -- Group posts
```

**Migration 013**: Fixes date casting:
```sql
(CURRENT_DATE - INTERVAL '29 days')::DATE  -- Explicit cast
```

**Migration 014**: Uses named parameters in triggers:
```sql
PERFORM award_points(
    p_user_id := NEW.author_id,
    p_action_type := 'post_created'::point_action_type,
    ...
);
```

## Verification Checklist
After running all 3 migrations:
- [ ] Create a post in general feed
- [ ] View post in feed
- [ ] Add reaction to post
- [ ] Comment on post
- [ ] Check leaderboard updates
