import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPost, updatePost, deletePost, togglePinPost, getCategories } from './post';
import { supabase } from './supabase';

// Mock the supabase client
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a new post and return it', async () => {
      const mockPost = {
        id: 'post-1',
        title: 'Test Post',
        content: 'Test content',
        author_id: 'user-1',
        created_at: new Date().toISOString(),
      };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await createPost({
        title: 'Test Post',
        content: 'Test content',
        author_id: 'user-1',
      });

      expect(supabase.from).toHaveBeenCalledWith('posts');
      expect(mockChain.insert).toHaveBeenCalled();
      expect(result).toEqual(mockPost);
    });

    it('should throw error when insert fails', async () => {
      const mockError = { message: 'Database error', code: '500' };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(
        createPost({
          title: 'Test',
          content: 'Test',
          author_id: 'user-1',
        })
      ).rejects.toEqual(mockError);
    });
  });

  describe('updatePost', () => {
    it('should update a post with is_edited flag and timestamp', async () => {
      const mockUpdatedPost = {
        id: 'post-1',
        title: 'Updated Title',
        content: 'Updated content',
        is_edited: true,
        updated_at: expect.any(String),
      };

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedPost, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await updatePost('post-1', { title: 'Updated Title' });

      expect(supabase.from).toHaveBeenCalledWith('posts');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          is_edited: true,
        })
      );
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'post-1');
      expect(result).toEqual(mockUpdatedPost);
    });
  });

  describe('deletePost', () => {
    it('should delete a post by ID', async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await deletePost('post-1');

      expect(supabase.from).toHaveBeenCalledWith('posts');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'post-1');
    });

    it('should throw error when delete fails', async () => {
      const mockError = { message: 'Delete failed' };

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deletePost('post-1')).rejects.toEqual(mockError);
    });
  });

  describe('togglePinPost', () => {
    it('should toggle post pin status from false to true', async () => {
      // First call to get current status
      const selectMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_pinned: false }, error: null }),
      };

      // Second call to update
      const updateMock = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-1', is_pinned: true },
          error: null,
        }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(selectMock as any)
        .mockReturnValueOnce(updateMock as any);

      const result = await togglePinPost('post-1');

      expect(result.is_pinned).toBe(true);
    });

    it('should toggle post pin status from true to false', async () => {
      const selectMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_pinned: true }, error: null }),
      };

      const updateMock = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-1', is_pinned: false },
          error: null,
        }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(selectMock as any)
        .mockReturnValueOnce(updateMock as any);

      const result = await togglePinPost('post-1');

      expect(result.is_pinned).toBe(false);
    });
  });

  describe('getCategories', () => {
    it('should fetch all categories ordered by name', async () => {
      const mockCategories = [
        { id: '1', name: 'General', slug: 'general', color: '#3B82F6' },
        { id: '2', name: 'YouTube', slug: 'youtube', color: '#EF4444' },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getCategories('group-1');

      expect(supabase.from).toHaveBeenCalledWith('categories');
      expect(result).toEqual(mockCategories);
    });

    it('should return empty array on error', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getCategories();

      expect(result).toEqual([]);
    });
  });
});
