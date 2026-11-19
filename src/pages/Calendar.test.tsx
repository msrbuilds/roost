import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar';
import { getEventsInRange, getUpcomingEvents } from '@/services';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/services', () => ({
    getEventsInRange: vi.fn().mockResolvedValue([]),
    getUpcomingEvents: vi.fn().mockResolvedValue([]),
    createEvent: vi.fn(), rsvpToEvent: vi.fn(), getAttendeeCounts: vi.fn(), getUserRSVP: vi.fn(),
}));
vi.mock('@/services/group', () => ({ getUserGroups: vi.fn() }));
vi.mock('@/components/calendar', () => ({ CalendarView: ({ onRangeChange }: { onRangeChange: (range: { start: Date; end: Date }) => void }) => (
    <button onClick={() => onRangeChange({ start: new Date('2027-01-01'), end: new Date('2027-02-01') })}>Next range</button>
) }));
vi.mock('@/components/events', () => ({ EventForm: () => null, EventCard: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('calendar loading', () => {
    it('fetches upcoming events once and keeps the calendar mounted when browsing dates', async () => {
        render(<Calendar />);
        const next = await screen.findByRole('button', { name: 'Next range' });
        await waitFor(() => expect(getUpcomingEvents).toHaveBeenCalledTimes(1));
        fireEvent.click(next);
        await waitFor(() => expect(getEventsInRange).toHaveBeenCalledTimes(2));
        expect(getUpcomingEvents).toHaveBeenCalledTimes(1);
        expect(next.isConnected).toBe(true);
    });
});
