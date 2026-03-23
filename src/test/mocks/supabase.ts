import { vi } from 'vitest';

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn((_table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/test-path' },
      }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  bio: null,
  location: null,
  role: 'member',
  is_online: false,
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  id: 'test-post-id',
  user_id: 'test-user-id',
  group_id: null,
  title: 'Test Post',
  content: 'Test post content',
  category: 'general',
  is_pinned: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockComment = (overrides = {}) => ({
  id: 'test-comment-id',
  post_id: 'test-post-id',
  user_id: 'test-user-id',
  content: 'Test comment',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockGroup = (overrides = {}) => ({
  id: 'test-group-id',
  name: 'Test Group',
  slug: 'test-group',
  description: 'Test group description',
  is_private: false,
  avatar_url: null,
  cover_url: null,
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-id',
  sender_id: 'test-user-id',
  receiver_id: 'test-receiver-id',
  content: 'Test message',
  is_read: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockNotification = (overrides = {}) => ({
  id: 'test-notification-id',
  user_id: 'test-user-id',
  type: 'post_comment',
  title: 'New Comment',
  message: 'Someone commented on your post',
  is_read: false,
  link: '/post/test-post-id',
  created_at: new Date().toISOString(),
  ...overrides,
});
