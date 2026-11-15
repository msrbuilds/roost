import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { from, leaderboard } = vi.hoisted(() => ({ from: vi.fn(), leaderboard: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from } }));
vi.mock('./leaderboard', () => ({ getGlobalLeaderboard: leaderboard }));
import { getUserGrowth, getActivityStats, getTopContributors } from './admin';

describe('admin dashboard data', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T17:00:00Z')); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());
  const query = (data: unknown[], error: Error | null = null) => {
    const chain = { select: vi.fn(), gte: vi.fn(), lte: vi.fn() };
    chain.select.mockReturnValue(chain); chain.gte.mockReturnValue(chain); chain.lte.mockResolvedValue({ data, error });
    return chain;
  };
  it('includes today and the complete first day in member growth', async () => {
    const chain = query([{ created_at: '2026-11-15T08:00:00Z' }, { created_at: '2026-10-17T01:00:00Z' }]);
    from.mockReturnValue(chain);
    const result = await getUserGrowth(30);
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual({ date: '2026-10-17', count: 1 });
    expect(result[result.length - 1]).toEqual({ date: '2026-11-15', count: 1 });
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-10-17T00:00:00.000Z');
  });
  it('includes current-day posts and comments in activity', async () => {
    from.mockReturnValue(query([{ created_at: '2026-11-15T08:00:00Z' }]));
    const result = await getActivityStats(30);
    expect(result).toHaveLength(30);
    expect(result[result.length - 1]).toEqual({ date: '2026-11-15', posts: 1, comments: 1 });
  });
  it('reports failed activity queries instead of showing false zeroes', async () => {
    from.mockReturnValue(query([], new Error('Database unavailable')));
    await expect(getActivityStats()).rejects.toThrow('Database unavailable');
  });
  it('uses rolling contributor totals and skips missing member profiles', async () => {
    const entry = { user: { id: 'maya' }, total_points: 20 };
    leaderboard.mockResolvedValue({ entries: [entry, { user: null, total_points: 50 }] });
    expect(await getTopContributors(5)).toEqual([entry]);
    expect(leaderboard).toHaveBeenCalledWith(30, 5);
  });
});
