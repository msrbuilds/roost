import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getConversations,
  getConversationMessages,
  markConversationAsRead,
  getUnreadMessageCount,
  deleteMessage,
} from './message';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('./s3', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://s3.example.com/image.jpg'),
}));

describe('Message Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should fetch and aggregate conversations for a user', async () => {
      const currentUserId = 'user-1';
      const otherUserId = 'user-2';
      const mockMessages = [
        {
          id: 'msg-1',
          sender_id: currentUserId,
          recipient_id: otherUserId,
          content: 'Hello',
          is_read: true,
          created_at: new Date().toISOString(),
          sender: { id: currentUserId, username: 'user1', display_name: 'User 1' },
          recipient: { id: otherUserId, username: 'user2', display_name: 'User 2' },
        },
        {
          id: 'msg-2',
          sender_id: otherUserId,
          recipient_id: currentUserId,
          content: 'Hi there',
          is_read: false,
          created_at: new Date().toISOString(),
          sender: { id: otherUserId, username: 'user2', display_name: 'User 2' },
          recipient: { id: currentUserId, username: 'user1', display_name: 'User 1' },
        },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getConversations(currentUserId);

      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(result).toHaveLength(1);
      expect(result[0].otherUser.id).toBe(otherUserId);
      expect(result[0].unreadCount).toBe(1);
    });

    it('should return empty array when no messages exist', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getConversations('user-1');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockError = { message: 'Database error' };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(getConversations('user-1')).rejects.toEqual(mockError);
    });
  });

  describe('getConversationMessages', () => {
    it('should fetch messages between two users', async () => {
      const currentUserId = 'user-1';
      const otherUserId = 'user-2';
      const mockMessages = [
        {
          id: 'msg-1',
          sender_id: currentUserId,
          recipient_id: otherUserId,
          content: 'Hello',
          sender: { id: currentUserId, username: 'user1' },
          assets: [],
        },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getConversationMessages(currentUserId, otherUserId);

      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Hello');
    });

    it('should support pagination', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await getConversationMessages('user-1', 'user-2', 20, 10);

      expect(mockChain.range).toHaveBeenCalledWith(10, 29);
    });

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch error' };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(getConversationMessages('user-1', 'user-2')).rejects.toEqual(mockError);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages in a conversation as read', async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      // Last eq call resolves
      let eqCallCount = 0;
      mockChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 3) {
          return Promise.resolve({ error: null });
        }
        return mockChain;
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await markConversationAsRead('user-1', 'user-2');

      expect(mockChain.update).toHaveBeenCalledWith({
        is_read: true,
        read_at: expect.any(String),
      });
      expect(mockChain.eq).toHaveBeenCalledWith('recipient_id', 'user-1');
      expect(mockChain.eq).toHaveBeenCalledWith('sender_id', 'user-2');
    });
  });

  describe('getUnreadMessageCount', () => {
    it('should return unread message count for user', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      let eqCallCount = 0;
      mockChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ count: 3, error: null });
        }
        return mockChain;
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUnreadMessageCount('user-1');

      expect(mockChain.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(3);
    });

    it('should return 0 on error', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      let eqCallCount = 0;
      mockChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ count: null, error: { message: 'Error' } });
        }
        return mockChain;
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUnreadMessageCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message by ID', async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await deleteMessage('msg-1');

      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'msg-1');
    });

    it('should throw error on delete failure', async () => {
      const mockError = { message: 'Delete failed' };

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteMessage('msg-1')).rejects.toEqual(mockError);
    });
  });
});
