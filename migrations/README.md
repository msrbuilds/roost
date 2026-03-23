# Database Migrations for Skool Clone

This folder contains SQL migration scripts to set up the Supabase PostgreSQL database for the community platform.

## 📋 Migration Order

Run these migrations in order in your Supabase SQL Editor:

1. **001_initial_schema.sql** - Creates all database tables and indexes
2. **002_rls_policies.sql** - Sets up Row Level Security policies
3. **003_functions_triggers.sql** - Creates database functions and triggers

## 🚀 How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `001_initial_schema.sql`
5. Click **Run** or press `Ctrl+Enter`
6. Repeat for `002_rls_policies.sql` and `003_functions_triggers.sql`

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## 📊 Database Schema Overview

### Core Tables

| Table | Description | Key Features |
|-------|-------------|--------------|
| **profiles** | User profiles | Username, avatar, bio, online status |
| **groups** | Community groups | Name, privacy settings, creator |
| **group_members** | Group membership | User-group relationships, roles |
| **categories** | Post categories | Name, color, icon |
| **posts** | Community posts | Title, content, pinning, reactions |
| **comments** | Post comments | Threaded comments support |
| **reactions** | Likes/reactions | Emoji reactions to posts/comments |
| **assets** | Uploaded files | Images, videos, documents |
| **messages** | Direct messages | 1-on-1 messaging, read receipts |
| **notifications** | User notifications | Activity notifications |
| **leaderboard_entries** | Points/ranking | 30-day leaderboard tracking |
| **events** | Calendar events | Event scheduling, RSVPs |
| **event_attendees** | Event RSVPs | Going/Maybe/Not Going status |

### Custom Types (ENUMs)

- `group_role`: admin, moderator, member
- `reaction_type`: like, love, fire, clap, think
- `reactable_type`: post, comment
- `asset_type`: image, video, document, other
- `notification_type`: new_comment, new_reaction, new_message, mention, etc.
- `rsvp_status`: going, maybe, not_going

## 🔒 Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that:

- Allow users to manage their own data
- Restrict access based on group membership
- Protect private groups from unauthorized access
- Enable admins/moderators to manage content

### Helper Functions

- `is_group_member(group_id, user_id)` - Check group membership
- `is_group_admin_or_mod(group_id, user_id)` - Check admin/mod status

## ⚡ Automatic Features

### Triggers

1. **Auto Profile Creation** - Creates profile when user signs up
2. **Last Seen Tracking** - Updates `last_seen_at` on user activity
3. **Group Admin Assignment** - Adds creator as admin when group is created
4. **Notification Creation** - Sends notifications for:
   - New comments on posts
   - Reactions to posts/comments
   - New direct messages
5. **Leaderboard Points** - Awards points for:
   - Creating posts (+5 points)
   - Writing comments (+2 points)
   - Receiving reactions (+1 point)

### Utility Functions

- `get_user_post_count(user_id)` - Count user's posts
- `get_user_comment_count(user_id)` - Count user's comments
- `get_group_member_count(group_id)` - Count group members
- `get_group_online_count(group_id)` - Count online members
- `mark_message_read(message_id)` - Mark message as read
- `mark_all_notifications_read()` - Mark all notifications as read
- `search_posts(search_term, group_id)` - Full-text search for posts
- `search_users(search_term)` - Search for users by username/display name

### Cleanup Functions

- `cleanup_old_notifications()` - Remove read notifications older than 30 days
- `cleanup_old_leaderboard_entries()` - Remove leaderboard entries older than 90 days

## 🧪 Testing Migrations

After running migrations, verify everything is set up correctly:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

## 🔄 Rolling Back

If you need to rollback migrations:

```sql
-- Drop all tables (WARNING: This deletes all data!)
DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS leaderboard_entries CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS rsvp_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS asset_type CASCADE;
DROP TYPE IF EXISTS reactable_type CASCADE;
DROP TYPE IF EXISTS reaction_type CASCADE;
DROP TYPE IF EXISTS group_role CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_last_seen() CASCADE;
DROP FUNCTION IF EXISTS add_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS notify_on_comment() CASCADE;
DROP FUNCTION IF EXISTS notify_on_reaction() CASCADE;
DROP FUNCTION IF EXISTS notify_on_message() CASCADE;
DROP FUNCTION IF EXISTS award_points(UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS award_points_on_post() CASCADE;
DROP FUNCTION IF EXISTS award_points_on_comment() CASCADE;
DROP FUNCTION IF EXISTS award_points_on_reaction() CASCADE;
```

## 📝 Notes

- All timestamps use `TIMESTAMPTZ` (timezone-aware)
- UUIDs are used for all primary keys
- Indexes are created for frequently queried columns
- Foreign keys have `ON DELETE CASCADE` for automatic cleanup
- Text fields have length constraints to prevent abuse
- Username format is validated with regex: `^[a-zA-Z0-9_-]+$`

## 🆘 Troubleshooting

### Error: "relation already exists"

If you see this error, tables already exist. Either:
- Skip to the next migration
- Drop existing tables (see Rolling Back section)

### Error: "permission denied"

Make sure you're running migrations as the Supabase admin user in the SQL Editor.

### Error: "function does not exist"

Run migrations in order. Functions in migration 002 depend on tables from migration 001.

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
