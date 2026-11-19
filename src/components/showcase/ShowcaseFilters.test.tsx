import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowcaseFilters from './ShowcaseFilters';
import ShowcaseFilterSidebar from './ShowcaseFilterSidebar';
import type { ShowcaseFilters as Filters } from '@/types/showcase';

vi.mock('@/services/showcase', () => ({ getAllTags: vi.fn().mockResolvedValue([]) }));

describe.each(['toolbar', 'sidebar'] as const)('showcase %s search', (variant) => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('stays idle with an empty search and publishes each debounced change only once', async () => {
        const changed = vi.fn();
        function Harness() {
            const [filters, setFilters] = useState<Filters>({ sortBy: 'newest' });
            const onFiltersChange = (next: Filters) => {
                changed(next);
                setFilters(next);
            };
            return variant === 'sidebar'
                ? <ShowcaseFilterSidebar filters={filters} onFiltersChange={onFiltersChange} isOpen onToggle={() => {}} />
                : <ShowcaseFilters filters={filters} onFiltersChange={onFiltersChange} />;
        }
        await act(async () => { render(<Harness />); });
        const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
        await advance(1800);
        expect(changed).not.toHaveBeenCalled();

        const search = screen.getByPlaceholderText(variant === 'sidebar' ? 'Search projects...' : 'Search showcases...');
        fireEvent.change(search, { target: { value: 'Ro' } });
        await advance(200);
        fireEvent.change(search, { target: { value: 'Roost' } });
        await advance(299);
        expect(changed).not.toHaveBeenCalled();
        await advance(1);
        expect(changed).toHaveBeenCalledExactlyOnceWith({ sortBy: 'newest', search: 'Roost' });
        await advance(1800);
        expect(changed).toHaveBeenCalledTimes(1);

        fireEvent.change(search, { target: { value: '' } });
        await advance(300);
        expect(changed).toHaveBeenLastCalledWith({ sortBy: 'newest', search: undefined });
        expect(changed).toHaveBeenCalledTimes(2);
        await advance(1800);
        expect(changed).toHaveBeenCalledTimes(2);
    });
});
