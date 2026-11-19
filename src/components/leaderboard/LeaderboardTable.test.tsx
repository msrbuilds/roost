import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeaderboardTable from './LeaderboardTable';
import { getGlobalLeaderboard } from '@/services';

const live = vi.hoisted(() => ({ refresh: () => {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/services', () => ({
    getGlobalLeaderboard: vi.fn(), getGroupLeaderboard: vi.fn(),
    subscribeToLeaderboardChanges: vi.fn((_group, callback: () => void) => {
        live.refresh = callback;
        return { unsubscribe: vi.fn() };
    }),
}));
const result = { entries: [{ id: 'rank-1', user_id: 'member-1', rank: 1, total_points: 20, user: { display_name: 'Maya Chen', username: 'maya' } }], hasMore: false };
beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.mocked(getGlobalLeaderboard).mockResolvedValue(result as Awaited<ReturnType<typeof getGlobalLeaderboard>>);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('leaderboard background updates', () => {
    it('keeps current rows visible until fresh rankings arrive, including failed refreshes', async () => {
        render(<LeaderboardTable period={30} />);
        const name = await screen.findByText('Maya Chen');
        let finish!: (value: Awaited<ReturnType<typeof getGlobalLeaderboard>>) => void;
        vi.mocked(getGlobalLeaderboard).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        act(() => live.refresh());
        expect(name.isConnected).toBe(true);
        await act(async () => finish(result as Awaited<ReturnType<typeof getGlobalLeaderboard>>));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(getGlobalLeaderboard).mockRejectedValueOnce(new Error('Temporary network failure'));
        await act(async () => live.refresh());
        expect(screen.queryByText('No Data Yet')).toBeNull();
        expect(name.isConnected).toBe(true);
        error.mockRestore();
    });
});
