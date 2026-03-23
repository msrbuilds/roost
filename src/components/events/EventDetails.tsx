import { X, Calendar, MapPin, Video, User, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import type { EventWithDetails } from '../../types';
import type { RSVPStatus } from '../../types/database';
import RSVPButton from './RSVPButton';
import AttendeeList from './AttendeeList';
import { useAuth } from '../../contexts/AuthContext';

interface EventDetailsProps {
    event: EventWithDetails;
    isOpen: boolean;
    onClose: () => void;
    onRSVP?: (status: RSVPStatus) => Promise<void>;
    onEdit?: () => void;
    onDelete?: () => Promise<void>;
}

export default function EventDetails({
    event,
    isOpen,
    onClose,
    onRSVP,
    onEdit,
    onDelete,
}: EventDetailsProps) {
    const { user } = useAuth();
    const [deleting, setDeleting] = useState(false);
    const [showAttendees, setShowAttendees] = useState(false);

    if (!isOpen) return null;

    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);
    const isPast = endDate < new Date();
    const isCreator = user?.id === event.created_by;

    const handleDelete = async () => {
        if (!onDelete || !confirm('Are you sure you want to delete this event?')) return;

        try {
            setDeleting(true);
            await onDelete();
            onClose();
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[90vh] bg-white dark:bg-surface-900 rounded-lg shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-surface-700">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {event.title}
                        </h2>
                        {event.group && (
                            <p className="text-purple-600 dark:text-purple-400 font-medium">
                                {event.group.name}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Date & Time */}
                    <div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                            <Calendar size={20} />
                            <span className="font-semibold">Date & Time</span>
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 ml-7">
                            {format(startDate, 'EEEE, MMMM d, yyyy')}
                            <br />
                            {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                        </p>
                    </div>

                    {/* Location */}
                    <div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                            {event.is_virtual ? <Video size={20} /> : <MapPin size={20} />}
                            <span className="font-semibold">
                                {event.is_virtual ? 'Virtual Meeting' : 'Location'}
                            </span>
                        </div>
                        {event.is_virtual ? (
                            event.meeting_url ? (
                                <a
                                    href={event.meeting_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline ml-7"
                                >
                                    Join Meeting
                                </a>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 ml-7 italic">Meeting link will be shared closer to the event</p>
                            )
                        ) : (
                            <p className="text-gray-900 dark:text-gray-100 ml-7">{event.location || 'TBA'}</p>
                        )}
                    </div>

                    {/* Creator */}
                    {event.creator && (
                        <div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                                <User size={20} />
                                <span className="font-semibold">Hosted by</span>
                            </div>
                            <div className="flex items-center gap-2 ml-7">
                                {event.creator.avatar_url && (
                                    <img
                                        src={event.creator.avatar_url}
                                        alt={event.creator.display_name}
                                        className="w-8 h-8 rounded-full"
                                    />
                                )}
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{event.creator.display_name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">@{event.creator.username}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">About</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
                        </div>
                    )}

                    {/* RSVP Section */}
                    {onRSVP && !isPast && (
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Your Response</h3>
                            <RSVPButton
                                eventId={event.id}
                                currentStatus={event.userRSVP || null}
                                onRSVP={onRSVP}
                                attendeeCounts={event.attendeeCount}
                            />
                        </div>
                    )}

                    {/* Attendees */}
                    <div>
                        <button
                            onClick={() => setShowAttendees(!showAttendees)}
                            className="font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                            {showAttendees ? '▼' : '▶'} Attendees
                            {event.attendeeCount && ` (${event.attendeeCount.going + event.attendeeCount.maybe})`}
                        </button>
                        {showAttendees && <AttendeeList eventId={event.id} />}
                    </div>
                </div>

                {/* Footer with action buttons */}
                {isCreator && (
                    <div className="p-6 border-t border-gray-200 dark:border-surface-700 flex gap-3">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                <Edit size={18} />
                                Edit Event
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={18} />
                                {deleting ? 'Deleting...' : 'Delete Event'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
