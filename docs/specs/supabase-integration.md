# Supabase Integration Specification

## Overview

This document describes the Supabase integration for the Commune platform, covering authentication, database access, real-time subscriptions, and best practices.

---

## Configuration

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
```

### Client Setup

**File:** `/src/services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

## Authentication

### Auth Methods

The `auth` object provides simplified authentication methods:

```typescript
// Sign up with email/password
await auth.signUp(email, password, {
  username: 'johndoe',
  display_name: 'John Doe',
});

// Sign in
await auth.signIn(email, password);

// Sign out
await auth.signOut();

// Reset password
await auth.resetPassword(email);

// Update password
await auth.updatePassword(newPassword);
```

### Auth State Changes

Subscribe to authentication state changes:

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log('Auth event:', event);
    console.log('Session:', session);
  }
);

// Cleanup
subscription.unsubscribe();
```

### Auth Events

| Event | Description |
|-------|-------------|
| `SIGNED_IN` | User signed in |
| `SIGNED_OUT` | User signed out |
| `TOKEN_REFRESHED` | Token was refreshed |
| `USER_UPDATED` | User data updated |
| `PASSWORD_RECOVERY` | Password reset initiated |

---

## AuthContext

**File:** `/src/contexts/AuthContext.tsx`

Provides authentication state throughout the app:

```typescript
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email, password, metadata?) => Promise<void>;
  signIn: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email) => Promise<void>;
  updateProfile: (updates) => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

### Usage in Components

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, profile, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <div>Hello, {profile?.display_name}</div>;
}
```

---

## Database Access

### Table Helpers

The `db` object provides type-safe table access:

```typescript
// Get all posts
const { data, error } = await db.posts()
  .select('*')
  .order('created_at', { ascending: false });

// Get post with author
const { data } = await db.posts()
  .select(`
    *,
    author:profiles(id, username, display_name, avatar_url)
  `)
  .eq('id', postId)
  .single();

// Insert post
const { data, error } = await db.posts()
  .insert({
    title: 'My Post',
    content: 'Hello world',
    author_id: userId,
    group_id: groupId,
  })
  .select()
  .single();

// Update post
const { error } = await db.posts()
  .update({ title: 'Updated Title' })
  .eq('id', postId);

// Delete post
const { error } = await db.posts()
  .delete()
  .eq('id', postId);
```

### Available Tables

| Helper | Table |
|--------|-------|
| `db.profiles()` | `profiles` |
| `db.groups()` | `groups` |
| `db.groupMembers()` | `group_members` |
| `db.posts()` | `posts` |
| `db.comments()` | `comments` |
| `db.reactions()` | `reactions` |
| `db.messages()` | `messages` |
| `db.notifications()` | `notifications` |
| `db.assets()` | `assets` |
| `db.events()` | `events` |
| `db.eventAttendees()` | `event_attendees` |
| `db.leaderboardEntries()` | `leaderboard_entries` |
| `db.categories()` | `categories` |

---

## Real-time Subscriptions

### Channel Subscriptions

```typescript
// Subscribe to new posts
const channel = realtime.channel('posts-changes');

channel
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'posts',
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      console.log('New post:', payload.new);
    }
  )
  .subscribe();

// Cleanup
await channel.unsubscribe();
```

### Table Change Helper

```typescript
// Simplified subscription
const subscription = realtime.onTableChange<Post>(
  'posts',
  ({ new: newPost, old: oldPost, eventType }) => {
    if (eventType === 'INSERT') {
      // Handle new post
    } else if (eventType === 'UPDATE') {
      // Handle updated post
    } else if (eventType === 'DELETE') {
      // Handle deleted post
    }
  },
  {
    event: '*',
    filter: `group_id=eq.${groupId}`,
  }
);

// Cleanup
subscription.unsubscribe();
```

### Presence (Online Status)

```typescript
const presenceChannel = supabase.channel('online-users');

presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    console.log('Online users:', state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }
  });
```

---

## TypeScript Types

**File:** `/src/types/database.ts`

Types are based on the database schema:

```typescript
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Post = Database['public']['Tables']['posts']['Row'];
export type GroupRole = Database['public']['Enums']['group_role'];
// etc.
```

### Regenerating Types

Use Supabase CLI to regenerate types when schema changes:

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

---

## Error Handling

```typescript
try {
  const { data, error } = await db.posts().select('*');
  
  if (error) {
    // Handle Supabase error
    console.error('Database error:', error.message);
    throw error;
  }
  
  return data;
} catch (err) {
  // Handle unexpected errors
  console.error('Unexpected error:', err);
  throw err;
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `PGRST116` | No rows returned (single query) |
| `23505` | Unique constraint violation |
| `23503` | Foreign key violation |
| `42501` | RLS policy violation |

---

## Row Level Security

All tables have RLS enabled. Key policies:

- **profiles**: Users can only update their own profile
- **posts**: Only group members can view; authors can update/delete
- **messages**: Only sender/recipient can view
- **notifications**: Only recipient can view

See `/migrations/002_rls_policies.sql` for full policy definitions.

---

## Best Practices

1. **Use type-safe helpers** - `db.posts()` instead of `supabase.from('posts')`
2. **Handle errors** - Always check for errors in Supabase responses
3. **Cleanup subscriptions** - Unsubscribe from channels when component unmounts
4. **Batch operations** - Use transactions for multiple related changes
5. **Optimize queries** - Select only needed columns, use filters
6. **Never expose service role key** - Only use in secure server-side code

---

## Testing Connection

```typescript
async function testConnection() {
  const { data, error } = await supabase.from('profiles').select('count');
  
  if (error) {
    console.error('Connection failed:', error);
    return false;
  }
  
  console.log('Connection successful');
  return true;
}
```
