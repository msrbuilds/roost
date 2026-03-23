import { useState, useEffect, useCallback } from 'react';
import { Radio, Clock, Play, VideoOff, CalendarCheck, CalendarX, MessageSquare, ExternalLink, Lock, ChevronLeft } from 'lucide-react';
import { liveRoomService, type LiveStatus, type Recording, type UpcomingSession, type RsvpInfo } from '@/services/live-room';
import { supabase } from '@/services/supabase';
import LiveRoomChat from '@/components/live-room/LiveRoomChat';

function extractVideoId(embedUrl: string): string | null {
    const match = embedUrl.match(/youtube\.com\/embed\/([^?&/]+)/);
    return match ? match[1] : null;
}

// Module-level cache so data persists across navigations (component unmount/remount)
let cachedStatus: LiveStatus | null = null;
let cachedRecordings: Recording[] = [];
let cachedUpcoming: UpcomingSession[] = [];
let cachedRsvpStatuses: Record<string, RsvpInfo> = {};

export default function LiveRoom() {
    const [showChat, setShowChat] = useState(() => window.innerWidth >= 1024);
    const [status, setStatus] = useState<LiveStatus | null>(cachedStatus);
    const [recordings, setRecordings] = useState<Recording[]>(cachedRecordings);
    const [upcoming, setUpcoming] = useState<UpcomingSession[]>(cachedUpcoming);
    const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, RsvpInfo>>(cachedRsvpStatuses);
    const [isLoading, setIsLoading] = useState(cachedStatus === null);
    const [activeRecording, setActiveRecording] = useState<Recording | null>(null);
    const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const data = await liveRoomService.getStatus();
            setStatus(data);
            cachedStatus = data;
        } catch (error) {
            console.error('Error fetching live status:', error);
        }
    }, []);

    const fetchRecordings = useCallback(async () => {
        try {
            const data = await liveRoomService.getRecordings();
            setRecordings(data);
            cachedRecordings = data;
        } catch (error) {
            console.error('Error fetching recordings:', error);
        }
    }, []);

    const fetchUpcoming = useCallback(async () => {
        try {
            const data = await liveRoomService.getUpcoming();
            setUpcoming(data);
            cachedUpcoming = data;

            // Fetch RSVP status for each upcoming session
            const statuses: Record<string, RsvpInfo> = {};
            await Promise.all(
                data.map(async (session) => {
                    try {
                        statuses[session.id] = await liveRoomService.getRsvpStatus(session.id);
                    } catch {
                        statuses[session.id] = { hasRsvp: false, rsvp: null };
                    }
                })
            );
            setRsvpStatuses(statuses);
            cachedRsvpStatuses = statuses;
        } catch (error) {
            console.error('Error fetching upcoming sessions:', error);
        }
    }, []);

    // Initial load - only blocks render on true first load (no cached data)
    useEffect(() => {
        const load = async () => {
            await Promise.all([fetchStatus(), fetchRecordings(), fetchUpcoming()]);
            setIsLoading(false);
        };
        load();
    }, [fetchStatus, fetchRecordings, fetchUpcoming]);

    // Subscribe to real-time live_sessions changes
    useEffect(() => {
        const channel = supabase
            .channel('live-room-status')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_sessions',
                },
                () => {
                    fetchStatus();
                    fetchUpcoming();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchStatus, fetchUpcoming]);

    const handleRsvp = async (sessionId: string) => {
        setRsvpLoading(sessionId);
        try {
            await liveRoomService.rsvp(sessionId);
            setRsvpStatuses((prev) => ({
                ...prev,
                [sessionId]: { hasRsvp: true, rsvp: { id: '', created_at: new Date().toISOString() } },
            }));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to RSVP');
        } finally {
            setRsvpLoading(null);
        }
    };

    const handleCancelRsvp = async (sessionId: string) => {
        setRsvpLoading(sessionId);
        try {
            await liveRoomService.cancelRsvp(sessionId);
            setRsvpStatuses((prev) => ({
                ...prev,
                [sessionId]: { hasRsvp: false, rsvp: null },
            }));
        } catch (error) {
            console.error('Error canceling RSVP:', error);
        } finally {
            setRsvpLoading(null);
        }
    };

    const isRsvpOpen = (scheduledAt: string) => {
        const scheduledTime = new Date(scheduledAt).getTime();
        const cutoffTime = scheduledTime - 60 * 60 * 1000;
        return Date.now() < cutoffTime;
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start || !end) return '';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    const formatTimeUntil = (dateStr: string) => {
        const ms = new Date(dateStr).getTime() - Date.now();
        if (ms < 0) return 'Starting soon';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `in ${days}d ${hours % 24}h`;
        if (hours > 0) return `in ${hours}h`;
        const minutes = Math.floor(ms / (1000 * 60));
        return `in ${minutes}m`;
    };

    // Only show full-page spinner on true first load (no cached data)
    if (isLoading && !status) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Main scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                                Live Room
                            </h1>
                            <p className="mt-1 text-surface-500 dark:text-surface-400">
                                Watch live sessions and past recordings
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {status?.isLive && (
                                <>
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                        </span>
                                        LIVE NOW
                                    </span>
                                    {/* Mobile chat toggle */}
                                    <button
                                        onClick={() => setShowChat(!showChat)}
                                        className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Chat
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Live Stream Player */}
                    {status?.isLive && status.playerUrl ? (
                        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                        <Radio className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-surface-900 dark:text-surface-50">
                                            {status.session?.title || 'Live Session'}
                                        </h2>
                                        {status.session?.description && (
                                            <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                                                {status.session.description}
                                            </p>
                                        )}
                                        {status.session?.started_at && (
                                            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Started {formatDate(status.session.started_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {status.visibility === 'private' ? (
                                <div className="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <Lock className="w-12 h-12 text-amber-400 dark:text-amber-500 mb-4" />
                                    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">
                                        Private Stream
                                    </h3>
                                    <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-md">
                                        This session is a private YouTube stream. Click below to watch on YouTube. Make sure you're signed in with the email you used to RSVP.
                                    </p>
                                    <a
                                        href={`https://www.youtube.com/watch?v=${extractVideoId(status.playerUrl)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Watch on YouTube
                                    </a>
                                </div>
                            ) : (
                                <div className="relative aspect-video bg-black overflow-hidden">
                                    <iframe
                                        src={`${status.playerUrl}${status.playerUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`}
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title="Live stream"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 p-12 text-center">
                            <VideoOff className="w-16 h-16 mx-auto text-surface-300 dark:text-surface-600" />
                            <h2 className="mt-4 text-xl font-semibold text-surface-900 dark:text-surface-50">
                                No Live Session
                            </h2>
                            <p className="mt-2 text-surface-500 dark:text-surface-400 max-w-md mx-auto">
                                There's no live session right now. Check back later or browse past recordings below.
                            </p>
                        </div>
                    )}

                    {/* Upcoming Sessions with RSVP */}
                    {upcoming.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
                                Upcoming Sessions
                            </h2>
                            <div className="space-y-3">
                                {upcoming.map((session) => {
                                    const rsvpStatus = rsvpStatuses[session.id];
                                    const rsvpOpen = isRsvpOpen(session.scheduled_at);

                                    return (
                                        <div
                                            key={session.id}
                                            className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 mt-0.5">
                                                        <CalendarCheck className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-medium text-surface-900 dark:text-surface-50">
                                                            {session.title}
                                                        </h3>
                                                        {session.description && (
                                                            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                                                                {session.description}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-3 mt-2 text-xs text-surface-400 dark:text-surface-500">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {formatDate(session.scheduled_at)}
                                                            </span>
                                                            <span className="text-primary-500 font-medium">
                                                                {formatTimeUntil(session.scheduled_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-shrink-0">
                                                    {rsvpStatus?.hasRsvp ? (
                                                        <button
                                                            onClick={() => handleCancelRsvp(session.id)}
                                                            disabled={rsvpLoading === session.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50 group"
                                                        >
                                                            <CalendarCheck className="w-4 h-4 group-hover:hidden" />
                                                            <CalendarX className="w-4 h-4 hidden group-hover:block" />
                                                            <span className="group-hover:hidden">RSVP'd</span>
                                                            <span className="hidden group-hover:inline">Cancel</span>
                                                        </button>
                                                    ) : rsvpOpen ? (
                                                        <button
                                                            onClick={() => handleRsvp(session.id)}
                                                            disabled={rsvpLoading === session.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            <CalendarCheck className="w-4 h-4" />
                                                            {rsvpLoading === session.id ? 'Saving...' : 'RSVP'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-surface-400 dark:text-surface-500 px-3 py-1.5">
                                                            RSVP Closed
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Active Recording Player */}
                    {activeRecording && activeRecording.playerUrl && (
                        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                                        <Play className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-surface-900 dark:text-surface-50">
                                            {activeRecording.title}
                                        </h2>
                                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                                            {formatDate(activeRecording.started_at)}
                                            {activeRecording.started_at && activeRecording.ended_at && (
                                                <> &middot; {formatDuration(activeRecording.started_at, activeRecording.ended_at)}</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveRecording(null)}
                                    className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                                >
                                    Close
                                </button>
                            </div>
                            {activeRecording.visibility === 'private' ? (
                                <div className="p-8 text-center">
                                    <Lock className="w-10 h-10 mx-auto text-amber-400 dark:text-amber-500 mb-3" />
                                    <p className="text-surface-500 dark:text-surface-400 mb-4">
                                        This recording is private. Watch it on YouTube with your RSVP email.
                                    </p>
                                    <a
                                        href={`https://www.youtube.com/watch?v=${extractVideoId(activeRecording.playerUrl)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Watch on YouTube
                                    </a>
                                </div>
                            ) : (
                                <div className="relative aspect-video bg-black overflow-hidden">
                                    <iframe
                                        src={`${activeRecording.playerUrl}${activeRecording.playerUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`}
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={activeRecording.title}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Past Recordings */}
                    {recordings.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
                                Past Recordings
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {recordings.map((recording) => (
                                    <button
                                        key={recording.id}
                                        onClick={() => recording.playerUrl && setActiveRecording(recording)}
                                        disabled={!recording.playerUrl}
                                        className="text-left bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 mt-0.5">
                                                {recording.visibility === 'private' ? (
                                                    <Lock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                                ) : (
                                                    <Play className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-surface-900 dark:text-surface-50 truncate">
                                                    {recording.title}
                                                </h3>
                                                {recording.description && (
                                                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                                                        {recording.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2 text-xs text-surface-400 dark:text-surface-500">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatDate(recording.started_at)}</span>
                                                    {recording.started_at && recording.ended_at && (
                                                        <span>&middot; {formatDuration(recording.started_at, recording.ended_at)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && recordings.length === 0 && !status?.isLive && upcoming.length === 0 && (
                        <p className="text-center text-surface-400 dark:text-surface-500 py-8">
                            No past recordings available yet.
                        </p>
                    )}
                </div>
            </div>

            {/* Chat Sidebar (Showcase filter pattern) */}
            {status?.isLive && status.session && (
                <>
                    {/* Mobile overlay backdrop */}
                    {showChat && (
                        <div
                            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
                            onClick={() => setShowChat(false)}
                        />
                    )}
                    <aside
                        className={`
                            bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700
                            transition-all duration-300 overflow-hidden flex-shrink-0
                            ${showChat
                                ? 'fixed inset-y-0 right-0 w-80 z-50 lg:relative lg:z-auto lg:w-80 lg:sticky lg:top-0 lg:h-[calc(100vh-64px)]'
                                : 'hidden lg:block lg:sticky lg:top-0 lg:h-[calc(100vh-64px)] w-12'
                            }
                        `}
                    >
                        {/* Collapsed state - just toggle button (desktop only) */}
                        {!showChat && (
                            <div className="p-2">
                                <button
                                    onClick={() => setShowChat(true)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
                                    title="Show chat"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Expanded state - full chat */}
                        {showChat && (
                            <div className="flex flex-col h-full">
                                {/* Chat header with close */}
                                <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-primary-500" />
                                        <span className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                            Live Chat
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowChat(false)}
                                        className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded"
                                        title="Hide chat"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-surface-500 rotate-180" />
                                    </button>
                                </div>
                                {/* Chat body */}
                                <div className="flex-1 overflow-hidden">
                                    <LiveRoomChat sessionId={status.session.id} />
                                </div>
                            </div>
                        )}
                    </aside>
                </>
            )}
        </div>
    );
}
