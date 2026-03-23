# User Profile Specification

## Overview

This document describes the user profile system for Commune, including the profile page, settings page, avatar upload, and profile management.

---

## Profile Page (`/profile` and `/profile/:username`)

### Purpose
Display user profile information publicly or for the logged-in user.

### Features
- Display name and username
- Avatar image
- Bio/description
- Location and website links
- Join date
- Activity stats (posts, comments, points)
- Online status indicator

### Components
- `ProfileHeader` - Avatar, name, stats
- `ProfileBio` - Biography and links
- `ProfileActivity` - Recent posts and comments

---

## Settings Page (`/settings`)

### Purpose
Allow users to edit their profile information and account settings.

### Sections

#### Profile Settings
- Avatar upload/change
- Display name
- Username (with availability check)
- Bio (textarea, 500 char limit)
- Location
- Website URL

#### Account Settings
- Email (read-only, from auth)
- Change password
- Delete account (future)

#### Notification Settings (future)
- Email notifications toggle
- Push notifications toggle

---

## Avatar Upload

### Implementation
1. User selects image file
2. Client validates type (JPEG, PNG, GIF, WebP) and size (max 5MB)
3. Upload to S3 via `uploadAvatar()` function
4. Update profile with new avatar URL
5. Display new avatar immediately

### Technical Details
- **S3 Path**: `avatars/{user_id}/{timestamp}-{filename}`
- **Max Size**: 5MB
- **Allowed Types**: JPEG, PNG, GIF, WebP
- **Dimensions**: Displayed at various sizes (32px to 128px)

---

## Profile Service

### Functions

```typescript
// Get profile by user ID
async function getProfile(userId: string): Promise<Profile>

// Get profile by username
async function getProfileByUsername(username: string): Promise<Profile>

// Update profile
async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile>

// Check username availability
async function isUsernameAvailable(username: string): Promise<boolean>

// Update online status
async function updateOnlineStatus(userId: string, isOnline: boolean): Promise<void>

// Get online users count
async function getOnlineUsersCount(): Promise<number>
```

---

## Database Schema Reference

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## UI Components

### AvatarUpload
- Circular preview with edit overlay
- Click to open file picker
- Loading state during upload
- Error handling for failed uploads

### ProfileForm
- Form fields for all profile properties
- Real-time username availability check
- Character counter for bio
- Submit with loading state

### OnlineIndicator
- Green dot for online users
- Gray dot for offline
- Updates in real-time via Supabase presence

---

## Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/profile` | Profile | Authenticated (own profile) |
| `/profile/:username` | Profile | Public |
| `/settings` | Settings | Authenticated |

---

## Validation Rules

| Field | Rules |
|-------|-------|
| username | 3-30 chars, alphanumeric + underscore/hyphen, unique |
| display_name | 1-100 chars |
| bio | 0-500 chars |
| website | Valid URL format |
| avatar | Max 5MB, image types only |
