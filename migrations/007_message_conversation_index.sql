-- Migration: Add composite index for efficient conversation queries
-- Purpose: Optimize queries that fetch messages grouped by conversation partners
-- Date: 2026-01-24

-- Create composite index on messages table for conversation queries
-- This index uses LEAST/GREATEST to normalize the sender/recipient pair
-- regardless of message direction, enabling fast conversation lookups

CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- Additional index for unread message counts (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_messages_unread
ON messages (recipient_id, is_read, created_at DESC);

-- Comment on indexes
COMMENT ON INDEX idx_messages_conversation IS 'Optimizes conversation queries by normalizing sender/recipient pairs';
COMMENT ON INDEX idx_messages_unread IS 'Optimizes unread message count queries';
