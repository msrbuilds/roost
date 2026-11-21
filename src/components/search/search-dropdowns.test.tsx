import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalSearch from './GlobalSearch';
import MentionDropdown from '../feed/MentionDropdown';

const { globalSearch, searchUsers, auth } = vi.hoisted(() => ({
    globalSearch: vi.fn(), searchUsers: vi.fn(), auth: { user: { id: 'viewer' }, isPremium: true },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/services/search', () => ({ globalSearch, searchUsers, truncateText: (text: string) => text }));

const maya = { id: 'maya', username: 'maya', display_name: 'Maya Chen', avatar_url: null, type: 'user' };
const alex = { ...maya, id: 'alex', username: 'alex', display_name: 'Alex Morgan' };
const results = (user: typeof maya) => ({ users: [user], posts: [], groups: [] });
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
async function debounce() { await act(async () => { vi.advanceTimersByTime(300); }); }

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('global search request ordering and controls', () => {
    it('keeps the newest query results when an earlier request finishes later', async () => {
        const old = deferred<ReturnType<typeof results>>(), latest = deferred<ReturnType<typeof results>>();
        globalSearch.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
        render(<MemoryRouter><GlobalSearch /></MemoryRouter>);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Alex' } }); await debounce();
        fireEvent.change(input, { target: { value: 'Maya' } }); await debounce();
        await act(async () => latest.resolve(results(maya)));
        await act(async () => old.resolve(results(alex)));
        expect(screen.queryByText('Alex Morgan')).toBeNull();
        expect(screen.getByText('Maya Chen')).toBeTruthy();
    });

    it('allows clearing during loading and ignores the pending response', async () => {
        const pending = deferred<ReturnType<typeof results>>();
        globalSearch.mockReturnValueOnce(pending.promise);
        render(<MemoryRouter><GlobalSearch /></MemoryRouter>);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Maya' } }); await debounce();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        await act(async () => pending.resolve(results(maya)));
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
        expect(screen.queryByText('Maya Chen')).toBeNull();
        expect(screen.queryByLabelText('Searching')).toBeNull();
    });

    it.each(['Escape', 'outside click'])('does not reopen after dismissal by %s during loading', async method => {
        const pending = deferred<ReturnType<typeof results>>();
        globalSearch.mockReturnValueOnce(pending.promise);
        render(<MemoryRouter><GlobalSearch /></MemoryRouter>);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Maya' } }); await debounce();
        if (method === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
        else fireEvent.mouseDown(document.body);
        await act(async () => pending.resolve(results(maya)));
        expect(screen.queryByText('Maya Chen')).toBeNull();
    });
});

describe('mention suggestions', () => {
    it('inserts a clicked mention without submitting the surrounding comment form', async () => {
        searchUsers.mockResolvedValueOnce([maya]);
        const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
        const onSelect = vi.fn();
        render(<form onSubmit={onSubmit}><MentionDropdown query="Maya" onSelect={onSelect} onClose={vi.fn()} /></form>);
        await debounce();
        fireEvent.click(screen.getByRole('button', { name: /Maya Chen/ }));
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(maya);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('ignores stale results and keeps keyboard selection on the current query', async () => {
        const old = deferred<typeof maya[]>(), latest = deferred<typeof maya[]>();
        searchUsers.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
        const onSelect = vi.fn(), onClose = vi.fn();
        const view = render(<MentionDropdown query="Alex" onSelect={onSelect} onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'ArrowDown' }); await debounce();
        view.rerender(<MentionDropdown query="Maya" onSelect={onSelect} onClose={onClose} />); await debounce();
        await act(async () => latest.resolve([maya]));
        await act(async () => old.resolve([alex]));
        expect(screen.queryByText('Alex Morgan')).toBeNull();
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(maya);
    });
});
