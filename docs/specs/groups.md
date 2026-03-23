# Groups & Communities Specification

## Overview

Groups are specialized communities within the Commune platform. They allow users to organize around specific topics, interests, or learning paths. Each group has its own feed, members, and settings.

---

## Database Schema

### `groups` Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Group name (2-100 chars) |
| slug | TEXT | URL-friendly identifier (unique) |
| description | TEXT | Group description |
| avatar_url | TEXT | Group avatar image |
| cover_url | TEXT | Group cover/banner image |
| is_private | BOOLEAN | Private vs public visibility |
| created_by | UUID | Creator's profile ID |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### `group_members` Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| group_id | UUID | Reference to groups |
| user_id | UUID | Reference to profiles |
| role | group_role | 'admin' \| 'moderator' \| 'member' |
| joined_at | TIMESTAMPTZ | Join timestamp |

**Unique Constraint**: (group_id, user_id) - one membership per user per group

---

## Features

### 5.1 Group Discovery (`/groups`)
- **Browse Groups**: List all public groups with search and filtering
- **Group Cards**: Display name, description, avatar, member count
- **Join Actions**: Quick join button for public groups
- **Private Groups**: Show lock icon, hide content preview

### 5.2 Group Detail (`/groups/:slug`)
- **Group Header**: Cover image, avatar, name, description, member count
- **Membership Status**: Shows if user is member/admin/moderator
- **Group Feed**: Posts specific to this group (uses existing PostFeed)
- **Member List**: Sidebar showing recent members
- **Actions**: Join/Leave, Settings (for admins)

### 5.3 Group Management (Admin Only)
- **Create Group**: Name, slug, description, avatar, cover, privacy setting
- **Edit Group**: Update all group details
- **Delete Group**: Permanently remove group and all content
- **Member Management**: Remove members, change roles

### 5.4 Roles & Permissions
| Action | Admin | Moderator | Member |
|--------|-------|-----------|--------|
| View group content | ✓ | ✓ | ✓ |
| Create posts | ✓ | ✓ | ✓ |
| Edit own posts | ✓ | ✓ | ✓ |
| Delete own posts | ✓ | ✓ | ✓ |
| Delete any post | ✓ | ✓ | ✗ |
| Pin posts | ✓ | ✓ | ✗ |
| Remove members | ✓ | ✓ | ✗ |
| Promote to moderator | ✓ | ✗ | ✗ |
| Edit group settings | ✓ | ✗ | ✗ |
| Delete group | ✓ | ✗ | ✗ |

---

## Components

### Pages
- `Groups.tsx` - Discovery page listing all groups
- `GroupDetail.tsx` - Single group view with feed
- `GroupSettings.tsx` - Admin settings page

### Components (`src/components/groups/`)
- `GroupCard.tsx` - Card for group listing
- `GroupHeader.tsx` - Header with cover, avatar, info
- `GroupMembers.tsx` - Member list sidebar
- `CreateGroupModal.tsx` - Create/edit group form
- `GroupMemberRow.tsx` - Single member row with role actions

---

## Service Layer (`src/services/group.ts`)

### Types
```typescript
export interface GroupWithDetails extends Group {
  member_count: number;
  is_member: boolean;
  user_role: GroupRole | null;
  creator: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface GroupMemberWithProfile extends GroupMember {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface GetGroupsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  includePrivate?: boolean;
}
```

### Functions
```typescript
// Group CRUD
getGroups(options: GetGroupsOptions): Promise<{ groups: GroupWithDetails[]; hasMore: boolean }>
getGroupBySlug(slug: string, userId?: string): Promise<GroupWithDetails | null>
createGroup(group: GroupInsert): Promise<Group>
updateGroup(groupId: string, updates: GroupUpdate): Promise<Group>
deleteGroup(groupId: string): Promise<void>

// Membership
joinGroup(groupId: string, userId: string): Promise<GroupMember>
leaveGroup(groupId: string, userId: string): Promise<void>
getGroupMembers(groupId: string, options?: { limit?: number; offset?: number }): Promise<GroupMemberWithProfile[]>
updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<void>
removeMember(groupId: string, userId: string): Promise<void>

// Utilities
generateSlug(name: string): string
checkMembership(groupId: string, userId: string): Promise<GroupMember | null>
getMemberCount(groupId: string): Promise<number>
```

---

## Routes

```typescript
// App.tsx additions
<Route path="/groups" element={<Groups />} />
<Route path="/groups/:slug" element={<GroupDetail />} />
<Route path="/groups/:slug/settings" element={<GroupSettings />} />
```

---

## UI Flow

### Discovery Flow
1. User navigates to `/groups`
2. Fetch groups with `getGroups()`
3. Display grid of GroupCards
4. User clicks a group -> navigate to `/groups/:slug`

### Join Flow
1. User views group detail (non-member)
2. Clicks "Join Group" button
3. Call `joinGroup()` -> creates membership with 'member' role
4. UI updates to show member status
5. Notification sent to group admins (future)

### Create Flow (Admin Only)
1. Admin clicks "Create Group" button
2. Modal opens with form fields
3. On submit: validate, generate slug, call `createGroup()`
4. Redirect to new group detail page
5. Creator automatically becomes admin

---

## Implementation Order

1. **Service Layer** - `src/services/group.ts`
2. **Group Discovery Page** - `src/pages/Groups.tsx`
3. **Group Card Component** - `src/components/groups/GroupCard.tsx`
4. **Group Detail Page** - `src/pages/GroupDetail.tsx`
5. **Group Header Component** - `src/components/groups/GroupHeader.tsx`
6. **Group Members Component** - `src/components/groups/GroupMembers.tsx`
7. **Create Group Modal** - `src/components/groups/CreateGroupModal.tsx`
8. **Group Settings Page** - `src/pages/GroupSettings.tsx`
9. **Navigation Updates** - Add Groups to TopNav
10. **Route Configuration** - Update App.tsx

---

## Future Enhancements
- Group invitations (invite-only private groups)
- Group categories/tags for better discovery
- Group-level notifications settings
- Group analytics for admins
- Featured/pinned groups on discovery page
