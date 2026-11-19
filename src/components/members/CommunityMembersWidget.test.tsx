import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommunityMembersWidget } from './CommunityMembersWidget';
import { searchMembers } from '@/services/profile';
import type { Profile } from '@/types/database';

vi.mock('@/services/profile', () => ({ searchMembers: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('community members widget', () => {
    it('makes a single request for the selected tab', async () => {
        vi.mocked(searchMembers).mockResolvedValue([]);
        render(<MemoryRouter><CommunityMembersWidget /></MemoryRouter>);
        await waitFor(() => expect(searchMembers).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole('button', { name: 'Newest' }));
        await waitFor(() => expect(searchMembers).toHaveBeenCalledTimes(2));
        expect(searchMembers).toHaveBeenLastCalledWith({ sort: 'newest', limit: 5 });
    });

    it('does not let a slow previous tab replace the current member list', async () => {
        let finishOld!: (members: Awaited<ReturnType<typeof searchMembers>>) => void;
        vi.mocked(searchMembers).mockImplementation(({ sort } = {}) => sort === 'newest'
            ? Promise.resolve([{ id: 'new', username: 'new', display_name: 'Newest Member' } as Profile])
            : new Promise(resolve => { finishOld = resolve; }));
        const { container } = render(<MemoryRouter><CommunityMembersWidget /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Newest' }));
        await screen.findByText('Newest Member');
        await act(async () => finishOld([{ id: 'old', username: 'old', display_name: 'Old Member' } as Profile]));
        expect(screen.queryByText('Old Member')).toBeNull();
        expect(screen.queryByText('Newest Member')).not.toBeNull();
        expect(searchMembers).toHaveBeenCalledTimes(2);
        expect(container.querySelector('.animate-pulse')).toBeNull();
    });
});
