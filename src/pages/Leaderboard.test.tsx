import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Leaderboard from './Leaderboard';

const { getGroupBySlug, getGroupById } = vi.hoisted(() => ({ getGroupBySlug: vi.fn(), getGroupById: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/services/group', () => ({ getGroupBySlug, getGroupById }));
vi.mock('@/services', () => ({ getUserRank: async () => null }));
vi.mock('@/components/leaderboard', () => ({ LeaderboardTable: ({ groupId }: { groupId?: string }) => <div data-testid="leaderboard-table">{groupId || 'global'}</div> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function visit(path: string) {
    render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/classrooms/:slug/leaderboard" element={<Leaderboard />} /></Routes></MemoryRouter>);
}

it('resolves a classroom slug before loading its leaderboard and links back to the classroom', async () => {
    getGroupBySlug.mockResolvedValue({ id: 'sample-group-id', slug: 'design-studio' });
    visit('/classrooms/design-studio/leaderboard');
    expect((await screen.findByTestId('leaderboard-table')).textContent).toBe('sample-group-id');
    expect(getGroupBySlug).toHaveBeenCalledWith('design-studio', 'viewer');
    expect(screen.getByRole('link', { name: 'Back to Classroom' }).getAttribute('href')).toBe('/classrooms/design-studio');
});

it('supports leaderboard-card links that contain the classroom UUID', async () => {
    const id = '53daa590-1bd1-40ba-a341-a28df6079654';
    getGroupById.mockResolvedValue({ id, slug: 'design-studio' });
    visit(`/classrooms/${id}/leaderboard`);
    expect((await screen.findByTestId('leaderboard-table')).textContent).toBe(id);
    expect(getGroupById).toHaveBeenCalledWith(id, 'viewer');
    expect(getGroupBySlug).not.toHaveBeenCalled();
});

it('does not fall back to the global leaderboard when the classroom does not exist', async () => {
    getGroupBySlug.mockResolvedValue(null);
    visit('/classrooms/missing/leaderboard');
    expect(await screen.findByRole('heading', { name: 'Classroom not found' })).toBeTruthy();
    expect(screen.queryByTestId('leaderboard-table')).toBeNull();
});
