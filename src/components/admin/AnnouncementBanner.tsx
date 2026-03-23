import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { getActiveAnnouncements, dismissAnnouncement, getDismissedAnnouncementIds } from '../../services';
import type { Announcement, AnnouncementType } from '../../services';
import { useAuth } from '../../contexts/AuthContext';

interface AnnouncementBannerProps {
    groupId?: string | null;
}

const typeStyles: Record<AnnouncementType, { bg: string; border: string; icon: typeof Info }> = {
    info: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Info },
    warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-800', icon: AlertTriangle },
    success: { bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', icon: CheckCircle },
    error: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', icon: AlertCircle },
};

const typeTextColors: Record<AnnouncementType, string> = {
    info: 'text-blue-800 dark:text-blue-300',
    warning: 'text-yellow-800 dark:text-yellow-300',
    success: 'text-green-800 dark:text-green-300',
    error: 'text-red-800 dark:text-red-300',
};

const typeIconColors: Record<AnnouncementType, string> = {
    info: 'text-blue-500 dark:text-blue-400',
    warning: 'text-yellow-500 dark:text-yellow-400',
    success: 'text-green-500 dark:text-green-400',
    error: 'text-red-500 dark:text-red-400',
};

export default function AnnouncementBanner({ groupId }: AnnouncementBannerProps) {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnnouncements = async () => {
            if (!user) return;

            try {
                const [activeAnnouncements, dismissed] = await Promise.all([
                    getActiveAnnouncements(groupId || null),
                    getDismissedAnnouncementIds(user.id),
                ]);
                setAnnouncements(activeAnnouncements);
                setDismissedIds(new Set(dismissed));
            } catch (err) {
                console.error('Failed to load announcements:', err);
            } finally {
                setLoading(false);
            }
        };

        loadAnnouncements();
    }, [user, groupId]);

    const handleDismiss = async (announcementId: string) => {
        if (!user) return;

        try {
            await dismissAnnouncement(announcementId, user.id);
            setDismissedIds((prev) => new Set([...prev, announcementId]));
        } catch (err) {
            console.error('Failed to dismiss announcement:', err);
        }
    };

    if (loading) return null;

    const visibleAnnouncements = announcements.filter(
        (a) => !dismissedIds.has(a.id)
    );

    if (visibleAnnouncements.length === 0) return null;

    return (
        <div className="px-4 sm:px-6 lg:px-8 mt-4 space-y-2">
            {visibleAnnouncements.map((announcement) => {
                const style = typeStyles[announcement.type];
                const Icon = style.icon;

                return (
                    <div
                        key={announcement.id}
                        className={`${style.bg} ${style.border} border rounded-lg px-4 py-3 flex items-start gap-3`}
                    >
                        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${typeIconColors[announcement.type]}`} />
                        <div className="flex-1 min-w-0">
                            <h4 className={`font-medium ${typeTextColors[announcement.type]}`}>
                                {announcement.title}
                            </h4>
                            <p className={`text-sm mt-0.5 ${typeTextColors[announcement.type]} opacity-90`}>
                                {announcement.content}
                            </p>
                        </div>
                        {announcement.is_dismissible && (
                            <button
                                onClick={() => handleDismiss(announcement.id)}
                                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${typeTextColors[announcement.type]}`}
                                title="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
