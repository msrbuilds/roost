import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useState } from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarEvent, EventWithDetails } from '../../types';
import EventDetails from '../events/EventDetails';
import { rsvpToEvent, deleteEvent, updateEvent } from '../../services';
import type { RSVPStatus } from '../../types/database';
import EventForm, { type EventFormData } from '../events/EventForm';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales: { 'en-US': enUS },
});

interface CalendarViewProps {
    events: EventWithDetails[];
    onCreateEvent?: (start: Date, end: Date) => void;
    onRefresh?: () => void;
}

export default function CalendarView({ events, onCreateEvent, onRefresh }: CalendarViewProps) {
    const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [currentView, setCurrentView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Convert events to calendar format
    const calendarEvents: CalendarEvent[] = events.map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.start_time),
        end: new Date(event.end_time),
        resource: event,
    }));

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event.resource);
        setIsDetailsOpen(true);
    };

    const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
        if (onCreateEvent) {
            onCreateEvent(start, end);
        }
    };

    const handleRSVP = async (status: RSVPStatus) => {
        if (!selectedEvent) return;
        await rsvpToEvent(selectedEvent.id, selectedEvent.created_by, status);
        if (onRefresh) onRefresh();
    };

    const handleEdit = () => {
        setIsDetailsOpen(false);
        setIsEditOpen(true);
    };

    const handleUpdateEvent = async (data: EventFormData) => {
        if (!selectedEvent) return;
        await updateEvent(selectedEvent.id, {
            ...data,
            start_time: new Date(data.start_time).toISOString(),
            end_time: new Date(data.end_time).toISOString(),
        });
        setIsEditOpen(false);
        if (onRefresh) onRefresh();
    };

    const handleDelete = async () => {
        if (!selectedEvent) return;
        await deleteEvent(selectedEvent.id);
        setIsDetailsOpen(false);
        if (onRefresh) onRefresh();
    };

    // Event styling based on user RSVP status
    const eventStyleGetter = (event: CalendarEvent) => {
        const userRSVP = event.resource.userRSVP;
        const isPast = new Date(event.resource.end_time) < new Date();

        let backgroundColor = '#9333ea'; // default purple
        let borderColor = '#9333ea';

        if (isPast) {
            backgroundColor = '#9ca3af';
            borderColor = '#9ca3af';
        } else if (userRSVP === 'going') {
            backgroundColor = '#10b981';
            borderColor = '#059669';
        } else if (userRSVP === 'maybe') {
            backgroundColor = '#f59e0b';
            borderColor = '#d97706';
        }

        return {
            style: {
                backgroundColor,
                borderColor,
                borderLeft: `4px solid ${borderColor}`,
                opacity: isPast ? 0.6 : 1,
            },
        };
    };

    return (
        <div className="h-full bg-white dark:bg-surface-900 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-surface-700 p-4 calendar-container">
            <style>{`
                /* Dark mode styles for react-big-calendar */
                .dark .calendar-container .rbc-calendar {
                    color: #fafafa;
                }

                /* Toolbar */
                .dark .calendar-container .rbc-toolbar {
                    color: #fafafa;
                }

                .dark .calendar-container .rbc-toolbar button {
                    color: #d4d4d8;
                    background-color: transparent;
                    border: 1px solid #404040;
                }

                .dark .calendar-container .rbc-toolbar button:hover,
                .dark .calendar-container .rbc-toolbar button:focus {
                    background-color: #262626;
                    border-color: #525252;
                }

                .dark .calendar-container .rbc-toolbar button.rbc-active {
                    background-color: #262626;
                    border-color: #9333ea;
                    color: #fafafa;
                }

                /* Month view */
                .dark .calendar-container .rbc-month-view {
                    background-color: #171717;
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-header {
                    background-color: #262626;
                    border-color: #404040;
                    color: #fafafa;
                }

                .dark .calendar-container .rbc-day-bg {
                    background-color: #171717;
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-off-range-bg {
                    background-color: #0a0a0a;
                }

                .dark .calendar-container .rbc-today {
                    background-color: #1e1b4b;
                }

                .dark .calendar-container .rbc-date-cell {
                    color: #a3a3a3;
                }

                .dark .calendar-container .rbc-off-range .rbc-date-cell {
                    color: #525252;
                }

                /* Events */
                .calendar-container .rbc-event {
                    font-size: 0.7rem;
                    line-height: 1.1;
                    padding: 1px 3px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dark .calendar-container .rbc-event {
                    color: #ffffff;
                }

                .calendar-container .rbc-event-content {
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dark .calendar-container .rbc-event-label {
                    color: #e5e5e5;
                }

                /* Agenda view */
                .dark .calendar-container .rbc-agenda-view {
                    background-color: #171717;
                }

                .dark .calendar-container .rbc-agenda-view table {
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
                    background-color: #262626;
                    border-color: #404040;
                    color: #fafafa;
                }

                .dark .calendar-container .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
                    border-color: #404040;
                    color: #d4d4d8;
                }

                .dark .calendar-container .rbc-agenda-date-cell,
                .dark .calendar-container .rbc-agenda-time-cell {
                    color: #a3a3a3;
                }

                /* Week/Day view */
                .dark .calendar-container .rbc-time-view {
                    background-color: #171717;
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-time-header-content {
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-time-content {
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-time-slot {
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-day-slot .rbc-time-slot {
                    border-color: #262626;
                }

                .dark .calendar-container .rbc-timeslot-group {
                    border-color: #404040;
                }

                .dark .calendar-container .rbc-current-time-indicator {
                    background-color: #9333ea;
                }

                /* Show more link */
                .dark .calendar-container .rbc-show-more {
                    color: #a78bfa;
                }

                .dark .calendar-container .rbc-show-more:hover {
                    color: #c4b5fd;
                }
            `}</style>
            <BigCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '600px' }}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                selectable
                view={currentView}
                onView={setCurrentView}
                date={currentDate}
                onNavigate={setCurrentDate}
                eventPropGetter={eventStyleGetter}
                views={['month', 'week', 'day', 'agenda']}
            />

            {/* Event Details Modal */}
            {selectedEvent && (
                <EventDetails
                    event={selectedEvent}
                    isOpen={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    onRSVP={handleRSVP}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            )}

            {/* Edit Event Modal */}
            {selectedEvent && (
                <EventForm
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    onSubmit={handleUpdateEvent}
                    initialData={selectedEvent}
                />
            )}
        </div>
    );
}
