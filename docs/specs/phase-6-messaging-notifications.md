# Phase 6: Messaging System & Notifications - Technical Specification

**Date:** January 24, 2026
**Status:** ✅ Complete
**Version:** 1.0

---

## Overview

Phase 6 implements a complete messaging and notification system for the Commune community platform, including 1-on-1 direct messaging with real-time delivery, read receipts, file attachments, and a comprehensive notification center with real-time updates.

---

## Features Implemented

### 6.1: Direct Messaging

#### Core Messaging Features
- ✅ **1-on-1 Chat Interface** - Real-time bidirectional messaging between users
- ✅ **Conversation List** - Aggregated view of all conversations with last message preview
- ✅ **Message History** - Infinite scroll pagination (50 messages per page)
- ✅ **Read Receipts** - Automatic mark-as-read when conversation is opened
- ✅ **Unread Counts** - Real-time unread message badges
- ✅ **File Attachments** - Image upload support with S3 integration
- ✅ **Online Status** - Show user online/offline status in conversations
- ✅ **Last Seen** - Display last seen timestamps
- ✅ **New Conversation** - User search modal for starting new chats
- ✅ **Mobile Responsive** - Split layout adapts to mobile devices

#### Real-time Functionality
- ✅ Message delivery (instant updates when new messages arrive)
- ✅ Conversation list updates (new messages bubble to top)
- ✅ Read receipt synchronization
- ✅ Multi-tab support (messages sent from other tabs/devices sync)

#### User Experience
- ✅ **Optimistic Updates** - Messages appear immediately, sync with server
- ✅ **Keyboard Shortcuts** - Ctrl+Enter to send, ESC to cancel
- ✅ **Drag & Drop** - File upload via drag-and-drop
- ✅ **Empty States** - Clear guidance when no conversations exist
- ✅ **Error Handling** - Graceful failure recovery with retry options
- ✅ **Loading States** - Smooth loading indicators for all async operations

### 6.2: Notifications

#### Notification System
- ✅ **Notification Center** - Dropdown panel showing recent notifications
- ✅ **Notification Types** - Support for 8 types:
  - `new_comment` - Someone commented on your post
  - `new_reaction` - Someone reacted to your content
  - `new_message` - New direct message received
  - `new_follower` - Someone followed you
  - `group_invite` - Invited to join a group
  - `mention` - Someone mentioned you
  - `group_join_request` - Someone requested to join your group
  - `system` - System announcements
- ✅ **Real-time Delivery** - Instant notification updates via Supabase
- ✅ **Unread Badges** - Visual indicators in TopNav
- ✅ **Mark as Read** - Single or bulk mark-as-read functionality
- ✅ **Navigation** - Click notification to navigate to source
- ✅ **Auto-created Notifications** - Database triggers automatically create notifications

#### User Experience
- ✅ **Icon System** - Each notification type has a unique icon and color
- ✅ **Time Display** - Relative time formatting ("5 minutes ago")
- ✅ **Unread Highlighting** - Visual distinction between read/unread
- ✅ **Empty State** - Helpful message when no notifications exist

---

## Technical Architecture

### Database Layer

#### Existing Tables (Already Created in Phase 1)
```sql
-- messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id),
    recipient_id UUID REFERENCES profiles(id),
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    type notification_type,
    title TEXT,
    message TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### New Indexes (Phase 6)
```sql
-- Optimize conversation queries
CREATE INDEX idx_messages_conversation ON messages(
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- Optimize unread message counts
CREATE INDEX idx_messages_unread ON messages(
    recipient_id, is_read, created_at DESC
);
```

#### Row Level Security (RLS)
- Users can only view messages where they are sender or recipient
- Users can only view their own notifications
- Automatic notification creation via database triggers

### Service Layer

#### Message Service (`src/services/message.ts`)

**Extended Types:**
```typescript
interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>;
  assets?: Asset[];
}

interface Conversation {
  otherUser: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'last_seen_at'>;
  lastMessage: MessageWithSender;
  unreadCount: number;
  lastMessageAt: string;
}
```

**Core Methods:**
- `getConversations(userId)` - Aggregate messages by conversation partner
- `getConversationMessages(currentUserId, otherUserId, limit, offset)` - Paginated message history
- `sendMessage(recipientId, content, files?)` - Send new message with optional attachments
- `markConversationAsRead(currentUserId, otherUserId)` - Batch mark all messages as read
- `getUnreadMessageCount(userId)` - Get total unread count
- `getMessageById(messageId)` - Fetch single message
- `deleteMessage(messageId)` - Delete message
- `searchUsers(query)` - Search users for new conversations

**Conversation Aggregation Logic:**
1. Fetch all messages where user is sender OR recipient
2. Group by conversation partner (client-side aggregation)
3. Calculate unread counts per conversation
4. Sort by latest message timestamp

#### Notification Service (`src/services/notification.ts`)

**Core Methods:**
- `getNotifications(userId, limit, offset)` - Paginated notification list
- `markAsRead(notificationId)` - Mark single notification as read
- `markAllAsRead(userId)` - Bulk mark all as read
- `deleteNotification(notificationId)` - Delete notification
- `getUnreadNotificationCount(userId)` - Get total unread count
- `getNotificationIconInfo(type)` - Get icon and color for notification type

### Component Architecture

#### Messaging Components (`src/components/messages/`)

1. **Messages Page** (`Messages.tsx`)
   - Main page with split layout
   - Mobile responsive (hide/show logic)
   - State management for selected conversation
   - New message modal integration

2. **ConversationList** (`ConversationList.tsx`)
   - List of all conversations
   - Real-time subscription to ALL incoming messages
   - Sort by latest message
   - Empty state when no conversations

3. **ConversationItem** (`ConversationItem.tsx`)
   - Single conversation preview
   - Avatar with online indicator
   - Last message truncation
   - Unread count badge
   - Time formatting

4. **ChatView** (`ChatView.tsx`)
   - Message bubbles display
   - Infinite scroll (load older messages)
   - Real-time bidirectional subscription
   - Auto-mark-as-read when focused
   - Optimistic updates
   - Scroll position restoration

5. **MessageBubble** (`MessageBubble.tsx`)
   - Sent/received styling (alignment, colors)
   - Timestamp display
   - Image attachments with lightbox
   - File attachments with download links

6. **MessageInput** (`MessageInput.tsx`)
   - Auto-resizing textarea
   - Keyboard shortcuts (Ctrl+Enter, ESC)
   - Drag-and-drop file upload
   - File previews with removal
   - Character count (5000 limit)

7. **NewMessageModal** (`NewMessageModal.tsx`)
   - Portal-based modal
   - User search integration
   - Backdrop click to close

8. **UserSearchInput** (`UserSearchInput.tsx`)
   - Debounced search (300ms)
   - Dropdown results
   - Online status indicators
   - Minimum 2 characters to search

9. **EmptyChatState** (`EmptyChatState.tsx`)
   - Empty state when no conversation selected
   - Clear call-to-action

#### Notification Components (`src/components/notifications/`)

1. **NotificationCenter** (`NotificationCenter.tsx`)
   - Dropdown panel (similar to profile dropdown)
   - Real-time subscription when open
   - Mark all as read button
   - Navigation on click
   - Empty state

2. **NotificationItem** (`NotificationItem.tsx`)
   - Icon based on notification type
   - Unread highlighting
   - Time display
   - Click handler with navigation

3. **NotificationBadge** (`NotificationBadge.tsx`)
   - Reusable badge component
   - Shows count up to 9+
   - Hidden when count is 0

#### TopNav Integration

**Updated Components:**
- `src/components/navigation/TopNav.tsx`
  - Added unread message count badge
  - Added notification count badge
  - Integrated NotificationCenter dropdown
  - Real-time subscription for unread counts
  - Parallel count fetching (Promise.all)

---

## Real-time Subscription Patterns

### Pattern 1: Conversation List (Subscribe to ALL messages)
```typescript
const channel = supabase
  .channel(`user-messages-${currentUserId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `recipient_id=eq.${currentUserId}`
  }, async (payload) => {
    await loadConversations(false); // No loading spinner
  })
  .subscribe();
```

### Pattern 2: Chat View (Subscribe to specific conversation)
```typescript
const channel = supabase
  .channel(`conversation-${otherUserId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `sender_id=eq.${otherUserId},recipient_id=eq.${currentUserId}`
  }, async (payload) => {
    const newMessage = await getMessageById(payload.new.id);
    setMessages(prev => [...prev, newMessage]);
    if (document.hasFocus()) {
      await markConversationAsRead(otherUserId);
    }
  })
  .subscribe();
```

### Pattern 3: TopNav Unread Counts
```typescript
const channel = supabase
  .channel(`unread-counts-${userId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `recipient_id=eq.${userId}`
  }, fetchUnreadCounts)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, fetchUnreadCounts)
  .subscribe();
```

---

## Performance Optimizations

### Database
- ✅ Composite index on messages for fast conversation queries
- ✅ Index on recipient_id + is_read for fast unread counts
- ✅ Efficient count queries with `count: 'exact', head: true`

### API Calls
- ✅ Pagination (50 messages per page)
- ✅ Parallel queries (Promise.all for unread counts)
- ✅ Batch mark-as-read (update entire conversation at once)
- ✅ Debounced user search (300ms delay)

### UI/UX
- ✅ Optimistic updates (show immediately, sync after)
- ✅ Scroll position restoration on infinite scroll
- ✅ No loading spinner on real-time updates
- ✅ Client-side conversation aggregation

---

## Security

### Database Level
- ✅ Row Level Security (RLS) policies enforce privacy
- ✅ Users can only access their own messages/notifications
- ✅ Automatic notification creation via triggers (users can't forge)

### Application Level
- ✅ Input validation (5000 character limit on messages)
- ✅ File type validation (images only)
- ✅ File size limits via S3 service
- ✅ XSS protection via content sanitization

---

## File Structure

```
src/
├── components/
│   ├── messages/
│   │   ├── ChatView.tsx
│   │   ├── ConversationItem.tsx
│   │   ├── ConversationList.tsx
│   │   ├── EmptyChatState.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── NewMessageModal.tsx
│   │   └── UserSearchInput.tsx
│   ├── notifications/
│   │   ├── NotificationBadge.tsx
│   │   ├── NotificationCenter.tsx
│   │   └── NotificationItem.tsx
│   └── navigation/
│       └── TopNav.tsx (updated)
├── pages/
│   └── Messages.tsx
├── services/
│   ├── message.ts
│   └── notification.ts
└── App.tsx (updated with /messages route)

migrations/
└── 007_message_conversation_index.sql
```

---

## Testing Checklist

### Messaging (Core)
- ✅ Send message from User A to User B
- ✅ User B receives message in real-time
- ✅ User B opens chat, messages marked as read automatically
- ✅ Unread count decreases in TopNav
- ✅ User B sends reply, User A receives in real-time
- ✅ Conversation list sorts by latest message
- ✅ Online status shows correctly
- ✅ Start new conversation works

### Notifications
- ✅ Notifications created by database triggers
- ✅ Unread notification count appears in TopNav
- ✅ Click notification navigates to source
- ✅ Mark as read updates count
- ✅ Mark all as read clears badge
- ✅ Real-time delivery works

### Mobile Responsiveness
- ✅ Conversation list hides when chat opens
- ✅ Back button appears in chat view
- ✅ Touch scrolling works smoothly

---

## Known Limitations & Future Enhancements

### Current Limitations
- No typing indicators (deferred to future phase)
- No message editing/deletion (only sender deletion)
- No message search
- No group messaging (1-on-1 only)
- No voice/video calls
- No read receipts visibility (who read)
- No message reactions

### Planned Enhancements (Phase 7+)
- Typing indicators using Supabase broadcast
- Message editing with edit history
- Full-text message search
- Group messaging (multiple participants)
- Voice messages (audio recording)
- Link previews (URL unfurling)
- Emoji/GIF picker
- Message reactions (similar to post reactions)
- Conversation archiving/muting
- Push notifications (browser API)
- Email notifications for unread messages

---

## Migration Instructions

### Database Migration
1. Open Supabase SQL Editor
2. Run the migration file: `migrations/007_message_conversation_index.sql`
3. Verify indexes were created successfully

### Deployment
1. Build the application: `npm run build`
2. Deploy to production environment
3. Monitor real-time subscriptions (Supabase Dashboard → Realtime)
4. Check error logs for any issues

---

## Key Learnings

### What Went Well
- Conversation aggregation on client-side works efficiently
- Real-time subscriptions scale well with filtered channels
- Optimistic updates provide excellent UX
- Mobile responsive split layout adapts perfectly

### Challenges Overcome
- Scroll position restoration on infinite scroll (solved with scrollHeight tracking)
- Duplicate messages from multiple tabs (solved with existence check)
- Conversation grouping performance (solved with Map data structure)

---

## Conclusion

Phase 6 successfully implements a production-ready messaging and notification system with real-time capabilities, excellent mobile support, and strong security. The foundation is solid for future enhancements like typing indicators, group messaging, and advanced features.

**Next Phase:** Phase 7 - Advanced Features (Calendar, Events, Leaderboards, Members Directory)
