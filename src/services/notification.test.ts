import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  getNotificationIconInfo,
} from './notification';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should fetch notifications for a user', async () => {
      const userId = 'user-1';
      const mockNotifications = [
        { id: 'notif-1', user_id: userId, type: 'new_comment', is_read: false },
        { id: 'notif-2', user_id: userId, type: 'new_reaction', is_read: true },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getNotifications(userId);

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(result).toEqual(mockNotifications);
    });

    it('should support pagination with offset and limit', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await getNotifications('user-1', 10, 20);

      expect(mockChain.range).toHaveBeenCalledWith(20, 29);
    });

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch failed' };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(getNotifications('user-1')).rejects.toEqual(mockError);
    });
  });

  describe('markAsRead', () => {
    it('should mark a single notification as read', async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await markAsRead('notif-1');

      expect(mockChain.update).toHaveBeenCalledWith({ is_read: true });
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should throw error on update failure', async () => {
      const mockError = { message: 'Update failed' };

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(markAsRead('notif-1')).rejects.toEqual(mockError);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a user', async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      // The last eq call resolves with no error
      mockChain.eq.mockImplementation(() => {
        return { ...mockChain, then: (resolve: any) => resolve({ error: null }) };
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await markAllAsRead('user-1');

      expect(mockChain.update).toHaveBeenCalledWith({ is_read: true });
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification by ID', async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await deleteNotification('notif-1');

      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should throw error on delete failure', async () => {
      const mockError = { message: 'Delete failed' };

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteNotification('notif-1')).rejects.toEqual(mockError);
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return the count of unread notifications', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      // Chain eq calls and resolve on the last one
      let eqCallCount = 0;
      mockChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ count: 5, error: null });
        }
        return mockChain;
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUnreadNotificationCount('user-1');

      expect(mockChain.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(5);
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

      const result = await getUnreadNotificationCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('getNotificationIconInfo', () => {
    it('should return correct icon for new_comment', () => {
      const result = getNotificationIconInfo('new_comment');
      expect(result).toEqual({ icon: 'MessageSquare', color: 'text-blue-600' });
    });

    it('should return correct icon for new_reaction', () => {
      const result = getNotificationIconInfo('new_reaction');
      expect(result).toEqual({ icon: 'Heart', color: 'text-red-600' });
    });

    it('should return correct icon for new_message', () => {
      const result = getNotificationIconInfo('new_message');
      expect(result).toEqual({ icon: 'Mail', color: 'text-primary-600' });
    });

    it('should return correct icon for new_follower', () => {
      const result = getNotificationIconInfo('new_follower');
      expect(result).toEqual({ icon: 'UserPlus', color: 'text-green-600' });
    });

    it('should return correct icon for group_invite', () => {
      const result = getNotificationIconInfo('group_invite');
      expect(result).toEqual({ icon: 'Users', color: 'text-purple-600' });
    });

    it('should return correct icon for mention', () => {
      const result = getNotificationIconInfo('mention');
      expect(result).toEqual({ icon: 'AtSign', color: 'text-orange-600' });
    });

    it('should return default icon for unknown types', () => {
      const result = getNotificationIconInfo('unknown_type');
      expect(result).toEqual({ icon: 'Bell', color: 'text-surface-600' });
    });
  });
});
