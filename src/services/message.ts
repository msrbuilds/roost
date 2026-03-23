import { supabase } from './supabase';
import type { Message, Profile, Asset } from '../types/database';
import { uploadImage } from './s3';

// Extended types for messages with author information
export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>;
  assets?: Asset[];
}

// Conversation interface aggregating messages by user pairs
export interface Conversation {
  otherUser: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'last_seen_at' | 'membership_type'>;
  lastMessage: MessageWithSender;
  unreadCount: number;
  lastMessageAt: string;
}

const MESSAGES_PER_PAGE = 50;

/**
 * Get all conversations for the current user
 * Aggregates messages grouped by conversation partner
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    // Step 1: Get distinct conversation partners and unread counts in parallel
    // Fetch only the latest message per conversation partner (limited window)
    const [sentResult, receivedResult, unreadResult] = await Promise.all([
      // Latest messages sent by user (get unique recipients)
      supabase
        .from('messages')
        .select(`
          id, sender_id, recipient_id, content, is_read, created_at,
          sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, is_online, last_seen_at, membership_type),
          recipient:profiles!messages_recipient_id_fkey(id, username, display_name, avatar_url, is_online, last_seen_at, membership_type)
        `)
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      // Latest messages received by user (get unique senders)
      supabase
        .from('messages')
        .select(`
          id, sender_id, recipient_id, content, is_read, created_at,
          sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, is_online, last_seen_at, membership_type),
          recipient:profiles!messages_recipient_id_fkey(id, username, display_name, avatar_url, is_online, last_seen_at, membership_type)
        `)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      // Unread counts grouped by sender
      supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', userId)
        .eq('is_read', false),
    ]) as any[];

    const sentMessages = sentResult.data || [];
    const receivedMessages = receivedResult.data || [];

    if (sentMessages.length === 0 && receivedMessages.length === 0) {
      return [];
    }

    // Build unread count map
    const unreadCountMap: Record<string, number> = {};
    (unreadResult.data || []).forEach((m: { sender_id: string }) => {
      unreadCountMap[m.sender_id] = (unreadCountMap[m.sender_id] || 0) + 1;
    });

    // Step 2: Merge and deduplicate - keep only the latest message per partner
    const conversationsMap = new Map<string, {
      otherUser: Profile;
      lastMessage: MessageWithSender;
      unreadCount: number;
      lastMessageAt: string;
    }>();

    const allMessages = [...sentMessages, ...receivedMessages]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const msg of allMessages) {
      const isCurrentUserSender = msg.sender_id === userId;
      const otherUserId = isCurrentUserSender ? msg.recipient_id : msg.sender_id;
      const otherUser = (isCurrentUserSender ? msg.recipient : msg.sender) as Profile;

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          otherUser,
          lastMessage: {
            ...msg,
            sender: msg.sender as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>
          },
          lastMessageAt: msg.created_at,
          unreadCount: unreadCountMap[otherUserId] || 0,
        });
      }
    }

    // Step 3: Convert to sorted array
    return Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  } catch (error) {
    console.error('Error in getConversations:', error);
    throw error;
  }
}

/**
 * Get messages for a specific conversation (paginated)
 */
export async function getConversationMessages(
  currentUserId: string,
  otherUserId: string,
  limit: number = MESSAGES_PER_PAGE,
  offset: number = 0
): Promise<MessageWithSender[]> {
  try {
    const { data, error } = (await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, is_online, membership_type),
        assets(*)
      `)
      .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)) as any;

    if (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }

    return (data || []).map((msg: any) => ({
      ...msg,
      sender: msg.sender as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>,
      assets: msg.assets as Asset[] | undefined
    }));
  } catch (error) {
    console.error('Error in getConversationMessages:', error);
    throw error;
  }
}

/**
 * Send a new message
 */
export async function sendMessage(
  recipientId: string,
  content: string,
  files?: File[]
): Promise<MessageWithSender> {
  try {
    // Validate content
    if (!content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    if (content.length > 5000) {
      throw new Error('Message content exceeds maximum length (5000 characters)');
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Step 1: Create the message
    const { data: message, error: messageError } = (await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: content.trim()
      } as any)
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, is_online, membership_type)
      `)
      .single()) as any;

    if (messageError) {
      console.error('Error sending message:', messageError);
      throw messageError;
    }

    // Step 2: Upload files if provided
    let uploadedAssets: Asset[] | undefined;
    if (files && files.length > 0) {
      uploadedAssets = [];

      for (const file of files) {
        try {
          const url = await uploadImage(file);

          // Create asset record
          const { data: asset, error: assetError } = (await supabase
            .from('assets')
            .insert({
              message_id: message.id,
              asset_type: file.type.startsWith('image/') ? 'image' : 'document',
              file_url: url,
              filename: file.name,
              file_size: file.size
            } as any)
            .select()
            .single()) as any;

          if (assetError) {
            console.error('Error creating asset record:', assetError);
          } else {
            uploadedAssets.push(asset);
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Continue with other files
        }
      }
    }

    return {
      ...message,
      sender: message.sender as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>,
      assets: uploadedAssets
    };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
}

/**
 * Mark all messages in a conversation as read (batch update)
 */
export async function markConversationAsRead(
  currentUserId: string,
  otherUserId: string
): Promise<void> {
  try {
    const result: any = await (supabase as any)
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('recipient_id', currentUserId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);

    const { error } = result;

    if (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markConversationAsRead:', error);
    throw error;
  }
}

/**
 * Get unread message count for current user
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadMessageCount:', error);
    return 0;
  }
}

/**
 * Get a single message by ID
 */
export async function getMessageById(messageId: string): Promise<MessageWithSender | null> {
  try {
    const { data, error} = (await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, is_online, membership_type),
        assets(*)
      `)
      .eq('id', messageId)
      .single()) as any;

    if (error) {
      console.error('Error fetching message:', error);
      return null;
    }

    return {
      ...data,
      sender: data.sender as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online'>,
      assets: data.assets as Asset[] | undefined
    };
  } catch (error) {
    console.error('Error in getMessageById:', error);
    return null;
  }
}

/**
 * Delete a message (only sender can delete)
 */
export async function deleteMessage(messageId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    throw error;
  }
}

/**
 * Search users for starting new conversations
 */
export async function searchUsers(query: string, limit: number = 10): Promise<Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>[]> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const { data, error } = (await supabase
      .rpc('search_users', {
        p_search_term: query.trim()
      } as any)
      .limit(limit)) as any;

    if (error) {
      console.error('Error searching users:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return [];
  }
}
