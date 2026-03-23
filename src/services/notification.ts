import { supabase } from './supabase';
import type { Notification } from '../types/database';

const NOTIFICATIONS_PER_PAGE = 20;

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  notify_comments: boolean;
  notify_replies: boolean;
  notify_mentions: boolean;
  notify_messages: boolean;
  notify_reactions: boolean;
  email_comments: boolean;
  email_replies: boolean;
  email_mentions: boolean;
  email_messages: boolean;
  email_announcements: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  notify_comments: true,
  notify_replies: true,
  notify_mentions: true,
  notify_messages: true,
  notify_reactions: true,
  email_comments: true,
  email_replies: true,
  email_mentions: true,
  email_messages: true,
  email_announcements: true,
};

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }

    // No preferences found, return defaults
    if (!data) {
      return DEFAULT_PREFERENCES;
    }

    return {
      notify_comments: data.notify_comments ?? true,
      notify_replies: data.notify_replies ?? true,
      notify_mentions: data.notify_mentions ?? true,
      notify_messages: data.notify_messages ?? true,
      notify_reactions: data.notify_reactions ?? true,
      email_comments: data.email_comments ?? true,
      email_replies: data.email_replies ?? true,
      email_mentions: data.email_mentions ?? true,
      email_messages: data.email_messages ?? true,
      email_announcements: data.email_announcements ?? true,
    };
  } catch (error) {
    console.error('Error in getNotificationPreferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateNotificationPreferences:', error);
    throw error;
  }
}

/**
 * Get notifications for the current user (paginated)
 */
export async function getNotifications(
  userId: string,
  limit: number = NOTIFICATIONS_PER_PAGE,
  offset: number = 0
): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNotifications:', error);
    throw error;
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    const result: any = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    const { error } = result;

    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markAsRead:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const result: any = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const { error } = result;

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    throw error;
  }
}

/**
 * Get unread notification count for current user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread notification count:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadNotificationCount:', error);
    return 0;
  }
}

/**
 * Extract @usernames from text content
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))]; // Remove @ and dedupe
}

/**
 * Create mention notifications for mentioned users
 */
export async function createMentionNotifications(
  mentionedUsernames: string[],
  actorId: string,
  actorName: string,
  postId: string
): Promise<void> {
  if (mentionedUsernames.length === 0) return;

  try {
    // Look up user IDs from usernames
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', mentionedUsernames);

    if (!users || users.length === 0) return;

    // Create notifications for each mentioned user (skip self-mentions)
    const notifications = users
      .filter(u => u.id !== actorId)
      .map(u => ({
        user_id: u.id,
        type: 'mention' as const,
        title: 'New Mention',
        message: `${actorName} mentioned you in a comment`,
        link: `/post/${postId}`,
        is_read: false,
      }));

    if (notifications.length === 0) return;

    await supabase.from('notifications').insert(notifications);
  } catch (error) {
    console.error('Error creating mention notifications:', error);
  }
}

/**
 * Get notification icon and color based on type
 */
export function getNotificationIconInfo(type: string): { icon: string; color: string } {
  switch (type) {
    case 'new_comment':
      return { icon: 'MessageSquare', color: 'text-blue-600' };
    case 'comment_reply':
      return { icon: 'Reply', color: 'text-cyan-600' };
    case 'new_reaction':
      return { icon: 'Heart', color: 'text-red-600' };
    case 'new_message':
      return { icon: 'Mail', color: 'text-primary-600' };
    case 'new_follower':
      return { icon: 'UserPlus', color: 'text-green-600' };
    case 'group_invite':
      return { icon: 'Users', color: 'text-purple-600' };
    case 'mention':
      return { icon: 'AtSign', color: 'text-orange-600' };
    case 'group_join_request':
      return { icon: 'UserCheck', color: 'text-indigo-600' };
    case 'system':
      return { icon: 'Bell', color: 'text-surface-600' };
    default:
      return { icon: 'Bell', color: 'text-surface-600' };
  }
}
