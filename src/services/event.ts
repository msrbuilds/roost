import { supabase } from './supabase';
import type { Event, EventAttendee, RSVPStatus } from '../types/database';

/**
 * Event Service
 * Handles event CRUD operations, RSVP management, and calendar queries
 */

// =======================
// EVENT CRUD OPERATIONS
// =======================

/**
 * Get events with optional filters
 */
export async function getEvents(
    groupId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<Event[]> {
    let query = supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });

    if (groupId) {
        query = query.eq('group_id', groupId);
    }

    if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
    }

    if (endDate) {
        query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Get single event by ID with creator and group details
 */
export async function getEventById(id: string) {
    const { data, error } = await supabase
        .from('events')
        .select(`
            *,
            creator:profiles!created_by (
                id,
                username,
                display_name,
                avatar_url
            ),
            group:groups!group_id (
                id,
                name,
                slug
            )
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as any;
}

/**
 * Create a new event
 */
export async function createEvent(eventData: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
    meeting_url?: string;
    is_virtual?: boolean;
    group_id?: string | null; // Optional for community events
    created_by: string;
}) {
    const { data, error } = await supabase
        .from('events')
        .insert([eventData as any])
        .select()
        .single();

    if (error) throw error;
    return data as any;
}

/**
 * Update an event
 */
export async function updateEvent(
    id: string,
    updates: Partial<Event>
) {
    const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// =======================
// RSVP OPERATIONS
// =======================

/**
 * RSVP to an event
 */
export async function rsvpToEvent(
    eventId: string,
    userId: string,
    status: RSVPStatus
): Promise<EventAttendee> {
    // Check if RSVP already exists
    const { data: existing } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        // Update existing RSVP
        const { data, error } = await supabase
            .from('event_attendees')
            .update({ status })
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data as EventAttendee;
    } else {
        // Create new RSVP
        const { data, error } = await supabase
            .from('event_attendees')
            .insert([{
                event_id: eventId,
                user_id: userId,
                status,
            }])
            .select()
            .single();

        if (error) throw error;
        return data as EventAttendee;
    }
}

/**
 * Get event attendees with profile information
 */
export async function getEventAttendees(eventId: string) {
    const { data, error } = await supabase
        .from('event_attendees')
        .select(`
            *,
            user:profiles!user_id (
                id,
                username,
                display_name,
                avatar_url,
                is_online
            )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
}

/**
 * Get attendee counts for an event
 */
export async function getAttendeeCounts(eventId: string) {
    const { data, error } = await supabase
        .from('event_attendees')
        .select('status')
        .eq('event_id', eventId);

    if (error) throw error;

    const counts = {
        going: 0,
        maybe: 0,
        not_going: 0,
    };

    ((data || []) as any[]).forEach((attendee) => {
        if (attendee.status === 'going') counts.going++;
        else if (attendee.status === 'maybe') counts.maybe++;
        else if (attendee.status === 'not_going') counts.not_going++;
    });

    return counts;
}

/**
 * Get user's RSVP status for an event
 */
export async function getUserRSVP(
    eventId: string,
    userId: string
): Promise<RSVPStatus | null> {
    const { data, error } = await supabase
        .from('event_attendees')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data?.status || null;
}

/**
 * Get events user has RSVP'd to
 */
export async function getUserEvents(
    userId: string,
    status?: RSVPStatus
) {
    let query = supabase
        .from('event_attendees')
        .select(`
            *,
            event:events!event_id (
                *,
                group:groups!group_id (
                    id,
                    name,
                    slug
                )
            )
        `)
        .eq('user_id', userId);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
}

// =======================
// CALENDAR OPERATIONS
// =======================

/**
 * Get events within a date range
 */
export async function getEventsInRange(
    startDate: Date,
    endDate: Date,
    groupId?: string
) {
    let query = supabase
        .from('events')
        .select(`
            *,
            creator:profiles!created_by (
                id,
                username,
                display_name,
                avatar_url
            ),
            group:groups!group_id (
                id,
                name,
                slug
            )
        `)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

    if (groupId) {
        query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
}

/**
 * Get upcoming events
 */
export async function getUpcomingEvents(
    groupId?: string,
    limit: number = 10
) {
    const now = new Date().toISOString();

    let query = supabase
        .from('events')
        .select(`
            *,
            creator:profiles!created_by (
                id,
                username,
                display_name,
                avatar_url
            ),
            group:groups!group_id (
                id,
                name,
                slug
            )
        `)
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(limit);

    if (groupId) {
        query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
}

// =======================
// REAL-TIME SUBSCRIPTIONS
// =======================

/**
 * Subscribe to event changes
 */
export function subscribeToEventChanges(
    groupId: string | null,
    callback: () => void
) {
    const channel = supabase
        .channel('event-updates')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'events',
                filter: groupId ? `group_id=eq.${groupId}` : undefined,
            },
            callback
        )
        .subscribe();

    return channel;
}

/**
 * Subscribe to RSVP changes for an event
 */
export function subscribeToEventRSVPs(
    eventId: string,
    callback: () => void
) {
    const channel = supabase
        .channel(`event-rsvps-${eventId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'event_attendees',
                filter: `event_id=eq.${eventId}`,
            },
            callback
        )
        .subscribe();

    return channel;
}
