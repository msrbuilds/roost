# Phase 5: Groups Enhancement - Technical Specification

**Status**: ✅ Completed
**Date**: January 2026
**Version**: 1.0

---

## Overview

Phase 5 extends the classroom/group functionality with three major enhancements:

1. **Tab-based Navigation**: Feed, Assets, and Recordings tabs for organized content
2. **Course Materials (Assets)**: Upload and manage PDF, DOC, DOCX, ZIP files for students
3. **Video Recordings**: Publish and manage YouTube/Vimeo videos with metadata
4. **Layout System**: Two distinct layout modes (Default and Sidebar) configurable per classroom

---

## Database Schema

### Migration 005: Group Tabs Features

**File**: `migrations/005_group_tabs_features.sql`

#### New Tables

**1. `group_assets` (Junction Table)**

Links assets to classrooms for course materials.

```sql
CREATE TABLE group_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, asset_id)
);

CREATE INDEX idx_group_assets_group ON group_assets(group_id);
CREATE INDEX idx_group_assets_asset ON group_assets(asset_id);
```

**Columns**:
- `id`: Primary key
- `group_id`: Reference to classroom
- `asset_id`: Reference to asset (file in S3)
- `uploaded_by`: User who uploaded the file
- `created_at`: Upload timestamp

**2. `recordings` Table**

Stores YouTube/Vimeo video metadata for classroom recordings.

```sql
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    video_platform TEXT NOT NULL CHECK (video_platform IN ('youtube', 'vimeo')),
    video_id TEXT NOT NULL,
    thumbnail_url TEXT,
    published_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recordings_group ON recordings(group_id);
```

**Columns**:
- `id`: Primary key
- `group_id`: Classroom this recording belongs to
- `title`: User-entered title (required)
- `description`: Optional description
- `video_url`: Full YouTube/Vimeo URL
- `video_platform`: 'youtube' | 'vimeo' (constraint enforced)
- `video_id`: Extracted video ID for embedding
- `thumbnail_url`: Auto-generated thumbnail URL
- `published_by`: User who published the video
- `created_at`: Publication timestamp

#### Row Level Security (RLS)

**Group Assets Policies:**

```sql
-- Members can view
CREATE POLICY "Group members can view group assets"
    ON group_assets FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Admins/mods can upload
CREATE POLICY "Group admins can upload assets"
    ON group_assets FOR INSERT
    WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()));

-- Admins/mods can delete
CREATE POLICY "Group admins can delete assets"
    ON group_assets FOR DELETE
    USING (is_group_admin_or_mod(group_id, auth.uid()));
```

**Recordings Policies:**

```sql
-- Members can view
CREATE POLICY "Group members can view recordings"
    ON recordings FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Admins/mods can publish
CREATE POLICY "Group admins can create recordings"
    ON recordings FOR INSERT
    WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()));

-- Admins/mods can update
CREATE POLICY "Group admins can update recordings"
    ON recordings FOR UPDATE
    USING (is_group_admin_or_mod(group_id, auth.uid()));

-- Admins/mods can delete
CREATE POLICY "Group admins can delete recordings"
    ON recordings FOR DELETE
    USING (is_group_admin_or_mod(group_id, auth.uid()));
```

### Migration 006: Layout Mode

**File**: `migrations/006_add_group_layout_mode.sql`

Adds layout preference to groups table.

```sql
ALTER TABLE groups
ADD COLUMN layout_mode TEXT NOT NULL DEFAULT 'sidebar'
CHECK (layout_mode IN ('default', 'sidebar'));

COMMENT ON COLUMN groups.layout_mode IS
    'Preferred layout mode for classroom detail page: default (header top) or sidebar (header right)';
```

**Values**:
- `'default'`: Header at top, tabs below (original layout)
- `'sidebar'`: Header in right sidebar, tabs inline with content

**Default**: `'sidebar'` (new layout is default for new classrooms)

---

## Component Architecture

### File Structure

```
src/components/groups/
├── GroupCard.tsx                # Classroom card in discovery
├── GroupHeader.tsx              # Classroom header (cover, avatar, stats)
├── GroupMembers.tsx             # Member list with role management
├── CreateGroupModal.tsx         # Create/edit classroom modal
├── GroupTabs.tsx               # ⭐ NEW: Tab navigation
├── GroupAssets.tsx             # ⭐ NEW: Course materials table
├── UploadAssetsModal.tsx       # ⭐ NEW: File upload modal
├── GroupRecordings.tsx         # ⭐ NEW: Video recordings grid
├── RecordingCard.tsx           # ⭐ NEW: Individual video card
├── AddRecordingModal.tsx       # ⭐ NEW: Add video modal
├── DefaultGroupLayout.tsx      # ⭐ NEW: Default layout component
├── SidebarGroupLayout.tsx      # ⭐ NEW: Sidebar layout component
└── index.ts                    # Barrel exports
```

### 1. GroupTabs Component

**File**: `src/components/groups/GroupTabs.tsx`

Tab navigation for Feed, Assets, and Recordings.

**Props**:
```typescript
export type TabValue = 'feed' | 'assets' | 'recordings';

interface GroupTabsProps {
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}
```

**Features**:
- Full-width navigation bar
- Active tab highlighting (primary-600 border and text)
- Responsive design (horizontal scroll on mobile)
- Icons from Lucide React (BookOpen, FileText, Video)

**Usage**:
```tsx
<GroupTabs activeTab={activeTab} onTabChange={setActiveTab} />
```

### 2. GroupAssets Component

**File**: `src/components/groups/GroupAssets.tsx`

Course materials manager with table display.

**Props**:
```typescript
interface GroupAssetsProps {
    groupId: string;
    userRole: GroupRole | null;
}
```

**Features**:
- Table with columns: Name, Type, Size, Uploaded By, Date, Actions
- File type icons (Image, Video, FileText, File)
- Upload button (admin/moderator only)
- Download links for all files
- Delete with confirmation (admin/moderator only)
- Empty state with instructional text
- File size formatting (B, KB, MB)
- Date formatting (Jan 24, 2026)

**Permissions**:
```typescript
const canUpload = userRole && (userRole === 'admin' || userRole === 'moderator');
```

**Service Integration**:
```typescript
const assets = await getGroupAssets(groupId);  // Fetch
await deleteGroupAsset(assetId);              // Delete
```

### 3. UploadAssetsModal Component

**File**: `src/components/groups/UploadAssetsModal.tsx`

Drag-and-drop file upload modal using react-dropzone.

**Props**:
```typescript
interface UploadAssetsModalProps {
    isOpen: boolean;
    groupId: string;
    onClose: () => void;
    onSuccess: () => void;
}
```

**Features**:
- Drag-and-drop zone (react-dropzone)
- Multiple file upload
- Accepted types: PDF, DOC, DOCX, ZIP, RAR, images
- File preview list with remove buttons
- Upload progress tracking
- File validation (type and size)
- S3 upload to `groups/{groupId}/documents/`

**Upload Flow**:
1. User drops/selects files
2. Validate file types and sizes
3. Upload each file to S3 via `uploadFile()` or `uploadDocument()`
4. Create asset record in database
5. Link asset to group via `linkAssetToGroup()`
6. Refresh asset list on success

**S3 Path Structure**:
```
groups/{groupId}/documents/{timestamp}-{uuid}-{filename}
```

### 4. GroupRecordings Component

**File**: `src/components/groups/GroupRecordings.tsx`

Video recordings grid display.

**Props**:
```typescript
interface GroupRecordingsProps {
    groupId: string;
    userRole: GroupRole | null;
}
```

**Features**:
- Card grid layout (1 col mobile, 2 col tablet, 3 col desktop)
- Add Recording button (admin/moderator only)
- Empty state with instructional text
- Loading states
- Delete recording functionality

**Permissions**:
```typescript
const canPublish = userRole && (userRole === 'admin' || userRole === 'moderator');
```

**Service Integration**:
```typescript
const recordings = await getGroupRecordings(groupId);  // Fetch
await deleteRecording(recordingId);                   // Delete
```

### 5. RecordingCard Component

**File**: `src/components/groups/RecordingCard.tsx`

Individual video card with thumbnail and metadata.

**Props**:
```typescript
interface RecordingCardProps {
    recording: RecordingWithPublisher;
    canEdit: boolean;
    onDeleted: () => void;
}
```

**Features**:
- Video thumbnail from YouTube/Vimeo
- Play button overlay
- Title and description
- Publisher info (avatar, name)
- Published date
- Edit/Delete buttons (admin/moderator only)
- Click to play in modal (uses VideoEmbed component)
- Loading and error states

**Thumbnail URLs**:
```typescript
// YouTube
const url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

// Vimeo
const url = `https://vumbnail.com/${videoId}.jpg`;
```

### 6. AddRecordingModal Component

**File**: `src/components/groups/AddRecordingModal.tsx`

Modal for adding YouTube/Vimeo videos.

**Props**:
```typescript
interface AddRecordingModalProps {
    isOpen: boolean;
    groupId: string;
    onClose: () => void;
    onSuccess: () => void;
}
```

**Form Fields**:
- Video URL (required, validated)
- Title (required, 3-200 chars)
- Description (optional, max 1000 chars)

**URL Validation**:
```typescript
const extractVideoInfo = (url: string) => {
    // YouTube regex
    const ytMatch = url.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/
    );

    // Vimeo regex
    const vimeoMatch = url.match(
        /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/([0-9]+)/
    );

    // Return { platform, videoId, thumbnailUrl } or null
};
```

**Features**:
- Live video preview before saving
- URL validation with error messages
- VideoEmbed component integration
- Form validation
- Loading states during submission

### 7. Layout Components

#### DefaultGroupLayout

**File**: `src/components/groups/DefaultGroupLayout.tsx`

Original layout with header at top.

**Structure**:
```
┌─────────────────────────────────────┐
│          Group Header               │
│  (Cover, Avatar, Name, Stats)       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│      Tabs (Feed | Assets | Rec)     │
└─────────────────────────────────────┘
┌──────────────────────┬──────────────┐
│                      │              │
│   Main Content       │   Sidebar    │
│   (Feed/Assets/Rec)  │   (Members)  │
│                      │              │
└──────────────────────┴──────────────┘
```

**Props**:
```typescript
interface DefaultGroupLayoutProps {
    group: GroupWithDetails;
    canViewContent: boolean;
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
    onJoin: () => void;
    onLeave: () => void;
    isJoining: boolean;
    isLeaving: boolean;
    onMemberChange: () => void;
}
```

#### SidebarGroupLayout

**File**: `src/components/groups/SidebarGroupLayout.tsx`

Alternate layout with header in right sidebar.

**Structure**:
```
┌──────────────────────┬──────────────┐
│                      │              │
│   Tabs (Inline)      │ Group Header │
│   Content Below      │   (Compact)  │
│                      │              │
│   (Feed/Assets/Rec)  │   Members    │
│                      │              │
└──────────────────────┴──────────────┘
```

**Features**:
- Tabs inline with content (no separate tab bar)
- Header in right sidebar (bordered card)
- More compact design
- Better space utilization on wide screens

**Props**: Same as DefaultGroupLayout

---

## Service Layer

### File: `src/services/group.ts`

#### Assets Functions

```typescript
/**
 * Get all assets for a classroom
 */
export async function getGroupAssets(groupId: string): Promise<GroupAssetWithDetails[]> {
    const { data, error } = await supabase
        .from('group_assets')
        .select(`
            id,
            created_at,
            asset:assets!inner (
                id,
                filename,
                file_url,
                file_size,
                mime_type,
                asset_type
            ),
            uploader:profiles!uploaded_by (
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Link an existing asset to a classroom
 */
export async function linkAssetToGroup(
    groupId: string,
    assetId: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from('group_assets')
        .insert({
            group_id: groupId,
            asset_id: assetId,
            uploaded_by: userId,
        });

    if (error) throw error;
}

/**
 * Delete a group asset (removes link, not the file)
 */
export async function deleteGroupAsset(groupAssetId: string): Promise<void> {
    const { error } = await supabase
        .from('group_assets')
        .delete()
        .eq('id', groupAssetId);

    if (error) throw error;
}
```

#### Recordings Functions

```typescript
/**
 * Get all recordings for a classroom
 */
export async function getGroupRecordings(groupId: string): Promise<RecordingWithPublisher[]> {
    const { data, error } = await supabase
        .from('recordings')
        .select(`
            *,
            publisher:profiles!published_by (
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Create a new recording
 */
export async function createRecording(recording: {
    group_id: string;
    title: string;
    description: string | null;
    video_url: string;
    video_platform: 'youtube' | 'vimeo';
    video_id: string;
    thumbnail_url: string;
    published_by: string;
}): Promise<Recording> {
    const { data, error } = await supabase
        .from('recordings')
        .insert(recording)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a recording
 */
export async function updateRecording(
    id: string,
    updates: Partial<Pick<Recording, 'title' | 'description'>>
): Promise<Recording> {
    const { data, error } = await supabase
        .from('recordings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a recording
 */
export async function deleteRecording(id: string): Promise<void> {
    const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
```

---

## Type Definitions

### Database Types

**File**: `src/types/database.ts`

```typescript
export interface Database {
    public: {
        Tables: {
            // ... existing tables

            group_assets: {
                Row: {
                    id: string;
                    group_id: string;
                    asset_id: string;
                    uploaded_by: string;
                    created_at: string;
                };
                Insert: Omit<Row, 'id' | 'created_at'>;
                Update: Partial<Insert>;
            };

            recordings: {
                Row: {
                    id: string;
                    group_id: string;
                    title: string;
                    description: string | null;
                    video_url: string;
                    video_platform: string;
                    video_id: string;
                    thumbnail_url: string | null;
                    published_by: string;
                    created_at: string;
                };
                Insert: Omit<Row, 'id' | 'created_at'>;
                Update: Partial<Insert>;
            };

            groups: {
                Row: {
                    // ... existing fields
                    layout_mode: 'default' | 'sidebar';
                };
            };
        };
    };
}
```

### Application Types

**File**: `src/types/index.ts`

```typescript
export type BaseRecording = Database['public']['Tables']['recordings']['Row'];

export interface RecordingWithPublisher extends BaseRecording {
    publisher?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface GroupAssetWithDetails {
    id: string;
    created_at: string;
    asset: {
        id: string;
        filename: string;
        file_url: string;
        file_size: number | null;
        mime_type: string;
        asset_type: string;
    };
    uploader?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}
```

---

## Page Integration

### GroupDetail Page

**File**: `src/pages/GroupDetail.tsx`

**Before**: ~270 lines with both layouts inline
**After**: ~80 lines, delegates to layout components

```typescript
export default function GroupDetail() {
    const { slug } = useParams<{ slug: string }>();
    const { user } = useAuth();
    const [group, setGroup] = useState<GroupWithDetails | null>(null);
    const [activeTab, setActiveTab] = useState<TabValue>('feed');
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    // ... fetch, join, leave handlers

    const canViewContent = !group.is_private || group.is_member;

    const layoutProps = {
        group,
        canViewContent,
        activeTab,
        onTabChange: setActiveTab,
        onJoin: handleJoin,
        onLeave: handleLeave,
        isJoining,
        isLeaving,
        onMemberChange: fetchGroup,
    };

    // Render layout based on group preference
    if (group.layout_mode === 'default') {
        return <DefaultGroupLayout {...layoutProps} />;
    }

    return <SidebarGroupLayout {...layoutProps} />;
}
```

**Key Changes**:
- Tab state managed at page level
- Layout selection based on `group.layout_mode`
- Shared props object for both layouts
- Clean separation of concerns

### GroupSettings Page

**File**: `src/pages/GroupSettings.tsx`

**New Section**: Layout Settings

```typescript
const handleLayoutChange = async (newLayout: 'default' | 'sidebar') => {
    if (!group) return;

    try {
        setIsUpdatingLayout(true);
        await updateGroup(group.id, { layout_mode: newLayout });
        fetchGroup();
    } catch (err) {
        console.error('Error updating layout:', err);
        alert('Failed to update layout');
    } finally {
        setIsUpdatingLayout(false);
    }
};
```

**UI**:
- Two card-style buttons for layout selection
- Visual preview of each layout
- Active state with checkmark
- Icons: LayoutGrid (default) and Sidebar (sidebar)
- Disabled during update

---

## Features Summary

### 1. Tab Navigation

**Status**: ✅ Implemented

- Three tabs: Feed, Assets, Recordings
- Clean, responsive design
- Active state highlighting
- Icon support

### 2. Course Materials (Assets)

**Status**: ✅ Implemented

**Capabilities**:
- Upload PDF, DOC, DOCX, ZIP, RAR files
- Drag-and-drop interface
- Multiple file upload
- File size and type validation
- Table display with sorting
- Download functionality
- Delete with confirmation
- Permission-based UI (admin/moderator only for uploads)

**Storage**:
- AWS S3: `groups/{groupId}/documents/`
- Database: `group_assets` junction table
- Asset metadata: `assets` table

### 3. Video Recordings

**Status**: ✅ Implemented

**Capabilities**:
- Add YouTube/Vimeo videos via URL
- Automatic video ID extraction
- Thumbnail generation
- Video preview before publishing
- Grid display with cards
- Play videos in modal
- Edit title/description
- Delete recordings
- Permission-based UI (admin/moderator only for publishing)

**Supported Platforms**:
- YouTube (youtube.com, youtu.be)
- Vimeo (vimeo.com)

### 4. Layout System

**Status**: ✅ Implemented

**Two Layouts**:
1. **Default**: Header at top, tabs below content (original)
2. **Sidebar**: Header in right sidebar, tabs inline (new)

**Configuration**:
- Per-classroom setting in database
- Managed via Settings page
- Visual selection UI
- Default: Sidebar layout for new classrooms

---

## S3 Configuration

### CORS Policy

Required for file uploads from browser.

**Location**: AWS S3 Console → Bucket → Permissions → CORS

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "http://localhost:5173",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": ["ETag"]
    }
]
```

### Bucket Policy

Public read access for uploaded files.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### IAM Permissions

Minimum permissions for the app's IAM user.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

---

## Installation & Setup

### 1. Run Database Migrations

```bash
# In Supabase SQL Editor
# Run migrations/005_group_tabs_features.sql
# Run migrations/006_add_group_layout_mode.sql
```

### 2. Configure S3 CORS

Apply the CORS configuration to your S3 bucket (see above).

### 3. Install Dependencies

All dependencies are already in package.json:
- `react-dropzone` - File drag-and-drop
- `@aws-sdk/client-s3` - S3 uploads
- `lucide-react` - Icons

### 4. Update Environment Variables

Ensure these are set in `.env.local`:

```env
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-bucket-name
# IMPORTANT: never put AWS credentials in `VITE_*` env vars (browser-visible).
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

---

## Testing Checklist

### Database Setup
- [ ] Migration 005 ran successfully
- [ ] Migration 006 ran successfully
- [ ] Tables exist: `group_assets`, `recordings`
- [ ] RLS policies are active
- [ ] Test queries work for members vs non-members

### Tab Navigation
- [ ] Navigate to a classroom
- [ ] Click each tab (Feed, Assets, Recordings)
- [ ] Verify content switches correctly
- [ ] Check responsive layout on mobile

### Assets Tab
- [ ] As admin: Upload PDF file
- [ ] Upload DOC/DOCX file
- [ ] Upload ZIP file
- [ ] Verify files appear in table
- [ ] Download a file - verify it works
- [ ] Delete a file - verify removal
- [ ] As member: Verify upload button hidden
- [ ] Test empty state displays correctly

### Recordings Tab
- [ ] As admin: Add YouTube video URL
- [ ] Add Vimeo video URL
- [ ] Verify cards display with thumbnails
- [ ] Click card to play video
- [ ] Delete recording
- [ ] As member: Verify add button hidden
- [ ] Test empty state

### Layout System
- [ ] Navigate to classroom settings
- [ ] Switch to Default layout
- [ ] Verify header moves to top
- [ ] Switch to Sidebar layout
- [ ] Verify header moves to right sidebar
- [ ] Verify layout persists after page reload

### Permissions
- [ ] Join group as regular member
- [ ] Verify no upload/add buttons visible
- [ ] Promote to moderator
- [ ] Verify upload/add buttons now visible
- [ ] Test asset/recording uploads as moderator

### Edge Cases
- [ ] Upload invalid file type - should show error
- [ ] Upload oversized file - should show error
- [ ] Add invalid video URL - should show error
- [ ] Try to access private group as non-member - should fail
- [ ] Test with no internet connection
- [ ] Test S3 upload errors

---

## Performance Considerations

### Optimizations
- Lazy load recordings thumbnails
- Paginate assets table for large lists
- Cache video metadata
- Use `react-window` for virtualized lists (future)

### File Size Limits
- Images: 10 MB
- Videos: 100 MB (for local uploads)
- Documents: 100 MB
- Recordings: No limit (external YouTube/Vimeo)

---

## Future Enhancements

### Potential Improvements
1. **Asset Organization**:
   - Folders/categories for assets
   - Tags and labels
   - Search functionality
   - Bulk upload

2. **Recording Features**:
   - Playlists
   - Watch progress tracking
   - Comments on recordings
   - Automatic transcripts

3. **Layout System**:
   - Additional layout options
   - Per-user layout preferences
   - Mobile-specific layouts

4. **Analytics**:
   - Asset download tracking
   - Video view counts
   - Engagement metrics

---

## Migration Guide

### From Previous Version

If upgrading from Phase 4, run these steps:

1. **Backup Database**:
   ```bash
   # In Supabase, create a backup before running migrations
   ```

2. **Run Migrations**:
   - Execute migration 005
   - Execute migration 006

3. **Update Code**:
   - Pull latest code
   - Run `npm install`
   - Update `.env.local` with S3 credentials

4. **Configure S3**:
   - Apply CORS configuration
   - Verify bucket policy
   - Test file upload

5. **Test Thoroughly**:
   - Follow testing checklist above
   - Verify existing groups still work
   - Test new features

---

## Troubleshooting

### Common Issues

**"CORS Error" when uploading files**:
- Verify S3 CORS configuration is correct
- Check that your domain is in `AllowedOrigins`
- Ensure bucket region matches `VITE_AWS_REGION`

**"Permission denied" on asset operations**:
- Check RLS policies are active
- Verify user is admin/moderator for uploads
- Check user is group member for viewing

**"Invalid video URL"**:
- Ensure URL is from YouTube or Vimeo
- Check URL format matches regex patterns
- Test with standard share URLs

**Layout not switching**:
- Verify migration 006 ran successfully
- Check `layout_mode` column exists
- Clear browser cache
- Check browser console for errors

---

## Support & Documentation

### Related Documentation
- [S3 Integration Spec](./s3-integration.md)
- [Setup Guide](../setup_guide.md)
- [Development Plan](../development_plan.md)

### Code References
- Components: `src/components/groups/`
- Services: `src/services/group.ts`
- Pages: `src/pages/GroupDetail.tsx`, `src/pages/GroupSettings.tsx`
- Migrations: `migrations/005_*.sql`, `migrations/006_*.sql`

---

**Last Updated**: January 24, 2026
**Phase Status**: ✅ Complete and Production Ready
