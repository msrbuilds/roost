# Community Feed Specification

## Overview

The Community Feed is the central hub for user interaction, featuring an infinite-scrolling list of posts, real-time updates, and rich content creation capabilities.

## Components

### 1. `PostFeed.tsx`
The main container component responsible for:
- **State Management**: Posts list (`PostWithDetails[]`), pagination logic, loading states.
- **Infinite Scroll**: Uses `IntersectionObserver` to trigger `loadPosts` when scrolling to the bottom.
- **Real-time Subscriptions**: Listens to Supabase `postgres_changes` on the `posts` table (INSERT, UPDATE, DELETE) to update the feed instantly without manual refresh.
- **Filtering**: Manages category selection state.

### 2. `PostCard.tsx`
Renders individual post items.
- **Content**: Displays author info, timestamp, title, and rich text content.
- **Media**: fetches and renders associated assets using `MediaGallery` and `VideoEmbed`.
- **Interactions**: Handles Likes (Reactions), Edit, and Delete actions.
- **Optimized Rendering**: Uses `React.memo` (implicit via clean props) to avoid unnecessary re-renders.

### 3. `CreatePostModal.tsx`
Handles Post creation and editing.
- **Form Management**: Title, Category, and Content.
- **Asset Uploads**: Direct S3 integration for images (drag & drop or file picker).
- **Editor Integration**: Wraps `RichTextEditor`.
- **Logic**: Handles distinct "Create" vs "Update" flows, ensuring assets are linked to posts via the `assets` table.

## Data Model

### Post Query (`getPosts`)
Efficiently fetches posts with joined data:
- Author details (`profiles`)
- Category details (`categories`)
- Reaction counts and user's own reaction state.

### Real-time Logic
To maintain consistency:
- **INSERT**: New post ID is received -> Full post details are fetched -> Prepend to list.
- **UPDATE**: Post ID received -> Fetch details -> Map and replace in list.
- **DELETE**: Post ID received -> Filter out from list.

## Key Features

- **Infinite Scroll**: Fetches 10 posts at a time.
- **Optimistic Updates**: UI updates immediately for localized actions like "Like" (to be implemented fully) or deleting own post.
- **Rich Media**: Supports mixed content (Text + Images + Video Embeds).
