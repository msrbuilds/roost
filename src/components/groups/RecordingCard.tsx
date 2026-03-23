import { useState } from 'react';
import { Play, Trash2, Edit2, Loader2 } from 'lucide-react';
import { deleteRecording } from '@/services/group';
import VideoPlayerModal from './VideoPlayerModal';

interface RecordingCardProps {
    recording: any;
    canEdit: boolean;
    onDeleted: (id: string) => void;
    onEdit?: (recording: any) => void;
}

export default function RecordingCard({ recording, canEdit, onDeleted, onEdit }: RecordingCardProps) {
    const [showModal, setShowModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const getThumbnailUrl = (platform: string, videoId: string) => {
        if (platform === 'youtube') {
            return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else if (platform === 'vimeo') {
            // Vimeo thumbnails require API call, using placeholder
            return `https://vumbnail.com/${videoId}.jpg`;
        }
        return null;
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this recording?')) return;

        try {
            setIsDeleting(true);
            await deleteRecording(recording.id);
            onDeleted(recording.id);
        } catch (error) {
            console.error('Error deleting recording:', error);
            alert('Failed to delete recording');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const thumbnailUrl = getThumbnailUrl(recording.video_platform, recording.video_id);

    return (
        <>
            <div className="flex items-center gap-3 py-2 px-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded-lg transition-colors group">
                {/* Thumbnail */}
                <button
                    onClick={() => setShowModal(true)}
                    className="relative flex-shrink-0 w-28 h-16 rounded overflow-hidden bg-surface-900 dark:bg-surface-800"
                >
                    {thumbnailUrl && (
                        <img
                            src={thumbnailUrl}
                            alt={recording.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-6 h-6 text-white" fill="currentColor" />
                    </div>
                </button>

                {/* Title & Description */}
                <div className="flex-1 min-w-0">
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-left w-full"
                    >
                        <h3 className="text-sm font-medium text-surface-900 dark:text-surface-50 hover:text-primary-600 dark:hover:text-primary-400 transition-colors line-clamp-1">
                            {recording.title}
                        </h3>
                    </button>
                    {recording.description && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-1 mt-0.5">
                            {recording.description}
                        </p>
                    )}
                </div>

                {/* Date */}
                <div className="flex-shrink-0 text-xs text-surface-500 dark:text-surface-400 w-24 text-right">
                    {formatDate(recording.created_at)}
                </div>

                {/* Action buttons */}
                {canEdit && (
                    <div className="flex-shrink-0 flex items-center gap-1">
                        <button
                            onClick={() => onEdit?.(recording)}
                            className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="Edit recording"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-1.5 text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title="Delete recording"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Video Player Modal */}
            <VideoPlayerModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={recording.title}
                videoPlatform={recording.video_platform}
                videoId={recording.video_id}
            />
        </>
    );
}
