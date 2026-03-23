import { useState, useEffect } from 'react';
import { Plus, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarView } from '../components/calendar';
import { EventForm, EventCard, type EventFormData } from '../components/events';
import { getEventsInRange, getUpcomingEvents, createEvent, rsvpToEvent, getAttendeeCounts, getUserRSVP } from '../services';
import { getUserGroups, type GroupWithDetails } from '../services/group';
import type { EventWithDetails } from '../types';
import type { RSVPStatus } from '../types/database';

export default function Calendar() {
    const { user } = useAuth();
    const [events, setEvents] = useState<EventWithDetails[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date, end: Date } | null>(null);
    const [userGroups, setUserGroups] = useState<GroupWithDetails[]>([]);

    useEffect(() => {
        if (user) {
            getUserGroups(user.id).then(setUserGroups).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        Promise.all([loadEvents(), loadUpcoming()]);
    }, [selectedGroup]);

    const loadEvents = async () => {
        try {
            setLoading(true);
            // Load events for current month view
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

            const data = await getEventsInRange(start, end, selectedGroup);

            // Enhance events with attendee counts and user RSVP status
            const enhancedEvents = await Promise.all(
                data.map(async (event) => {
                    const [counts, userRSVP] = await Promise.all([
                        getAttendeeCounts(event.id),
                        user ? getUserRSVP(event.id, user.id) : Promise.resolve(null),
                    ]);

                    return {
                        ...event,
                        attendeeCount: counts,
                        userRSVP,
                    };
                })
            );

            setEvents(enhancedEvents);
        } catch (err) {
            console.error('Error loading events:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadUpcoming = async () => {
        try {
            const data = await getUpcomingEvents(selectedGroup, 5);

            // Enhance with counts and RSVP
            const enhancedEvents = await Promise.all(
                data.map(async (event) => {
                    const [counts, userRSVP] = await Promise.all([
                        getAttendeeCounts(event.id),
                        user ? getUserRSVP(event.id, user.id) : Promise.resolve(null),
                    ]);

                    return {
                        ...event,
                        attendeeCount: counts,
                        userRSVP,
                    };
                })
            );

            setUpcomingEvents(enhancedEvents);
        } catch (err) {
            console.error('Error loading upcoming events:', err);
        }
    };

    const handleCreateEvent = async (data: EventFormData) => {
        if (!user) return;

        await createEvent({
            ...data,
            start_time: new Date(data.start_time).toISOString(),
            end_time: new Date(data.end_time).toISOString(),
            created_by: user.id,
            group_id: data.group_id || null, // Allow null for community events
        });

        Promise.all([loadEvents(), loadUpcoming()]);
    };

    const handleRSVP = async (eventId: string, status: RSVPStatus) => {
        if (!user) return;
        await rsvpToEvent(eventId, user.id, status);
        Promise.all([loadEvents(), loadUpcoming()]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Community events and activities</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedSlot(null);
                        setIsCreateOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <Plus size={20} />
                    <span>Create Event</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Calendar */}
                <div className="lg:col-span-2">
                    <CalendarView
                        events={events}
                        onCreateEvent={(start, end) => {
                            setSelectedSlot({ start, end });
                            setIsCreateOpen(true);
                        }}
                        onRefresh={() => {
                            Promise.all([loadEvents(), loadUpcoming()]);
                        }}
                    />
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="bg-white dark:bg-surface-900 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-surface-700 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter size={18} className="text-gray-600 dark:text-gray-400" />
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Group</label>
                            <select
                                value={selectedGroup || ''}
                                onChange={(e) => setSelectedGroup(e.target.value || undefined)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">All Groups</option>
                                {userGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <div className="bg-white dark:bg-surface-900 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-surface-700 p-4">
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Upcoming Events</h2>
                        {upcomingEvents.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                                No upcoming events
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        onRSVP={(status) => handleRSVP(event.id, status)}
                                        showGroup={!selectedGroup}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Event Modal */}
            <EventForm
                isOpen={isCreateOpen}
                onClose={() => {
                    setIsCreateOpen(false);
                    setSelectedSlot(null);
                }}
                onSubmit={handleCreateEvent}
                groupId={selectedGroup}
                initialData={selectedSlot ? {
                    start_time: selectedSlot.start.toISOString(),
                    end_time: selectedSlot.end.toISOString()
                } : undefined}
            />
        </div>
    );
}
