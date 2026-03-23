import { MapPin, Video, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { EventWithDetails } from '../../types';
import RSVPButton from './RSVPButton';
import type { RSVPStatus } from '../../types/database';

interface EventCardProps {
    event: EventWithDetails;
    onRSVP?: (status: RSVPStatus) => Promise<void>;
    onClick?: () => void;
    showGroup?: boolean;
}

export default function EventCard({ event, onRSVP, onClick, showGroup = true }: EventCardProps) {
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);
    const isPast = endDate < new Date();

    return (
        <div
            className={`
                bg-white dark:bg-surface-900 rounded-lg border-2 overflow-hidden transition-all hover:shadow-lg dark:hover:shadow-none
                ${isPast ? 'opacity-60 border-gray-200 dark:border-surface-700' : 'border-gray-200 dark:border-surface-700 hover:border-purple-300 dark:hover:border-purple-600'}
                ${onClick ? 'cursor-pointer' : ''}
            `}
            onClick={onClick}
        >
            {/* Header with date badge */}
            <div className="relative bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 pb-6">
                <div className="flex justify-between items-start">
                    {/* Date badge */}
                    <div className="bg-white dark:bg-surface-800 rounded-lg shadow-md dark:shadow-none dark:border dark:border-surface-600 p-3 text-center min-w-[70px]">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {format(startDate, 'd')}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                            {format(startDate, 'MMM')}
                        </div>
                    </div>

                    {/* Virtual/In-person badge */}
                    <div className={`
                        px-3 py-1 rounded-full text-xs font-semibold
                        ${event.is_virtual
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }
                    `}>
                        {event.is_virtual ? 'Virtual' : 'In Person'}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-4">
                    {event.title}
                </h3>

                {/* Group name */}
                {showGroup && event.group && (
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                        {event.group.name}
                    </p>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Time */}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span>
                        {format(startDate, 'MMM d, h:mm a')} - {format(endDate, 'h:mm a')}
                    </span>
                </div>

                {/* Location */}
                {event.is_virtual ? (
                    event.meeting_url && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Video size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <span className="truncate">Online Meeting</span>
                        </div>
                    )
                ) : (
                    event.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                        </div>
                    )
                )}

                {/* Attendee count */}
                {event.attendeeCount && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span>
                            {event.attendeeCount.going} going
                            {event.attendeeCount.maybe > 0 && `, ${event.attendeeCount.maybe} maybe`}
                        </span>
                    </div>
                )}

                {/* Description preview */}
                {event.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {event.description}
                    </p>
                )}

                {/* RSVP Buttons */}
                {onRSVP && !isPast && (
                    <div className="pt-3 border-t border-gray-100 dark:border-surface-700">
                        <RSVPButton
                            eventId={event.id}
                            currentStatus={event.userRSVP || null}
                            onRSVP={onRSVP}
                            attendeeCounts={event.attendeeCount}
                        />
                    </div>
                )}

                {/* Past event indicator */}
                {isPast && (
                    <div className="pt-3 border-t border-gray-100 dark:border-surface-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">This event has ended</span>
                    </div>
                )}
            </div>
        </div>
    );
}
