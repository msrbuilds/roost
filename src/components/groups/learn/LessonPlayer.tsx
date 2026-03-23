import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { markLessonComplete, markLessonIncomplete } from '@/services/module';
import type { RecordingWithCompletion } from '@/types';

interface LessonPlayerProps {
    recording: RecordingWithCompletion;
    moduleId: string;
    userId: string;
    prevRecording: { id: string; title: string } | null;
    nextRecording: { id: string; title: string } | null;
    onNavigate: (recordingId: string) => void;
    onCompletionChange: () => void;
    commentSection?: React.ReactNode;
}

export default function LessonPlayer({
    recording,
    moduleId,
    userId,
    prevRecording,
    nextRecording,
    onNavigate,
    onCompletionChange,
    commentSection,
}: LessonPlayerProps) {
    const [isCompleted, setIsCompleted] = useState(recording.is_completed);
    const [isToggling, setIsToggling] = useState(false);

    const getEmbedUrl = () => {
        if (recording.video_platform === 'youtube') {
            return `https://www.youtube.com/embed/${recording.video_id}?autoplay=0&rel=0`;
        } else if (recording.video_platform === 'vimeo') {
            return `https://player.vimeo.com/video/${recording.video_id}`;
        }
        return null;
    };

    const handleToggleComplete = async () => {
        try {
            setIsToggling(true);
            if (isCompleted) {
                await markLessonIncomplete(userId, recording.id);
                setIsCompleted(false);
            } else {
                await markLessonComplete(userId, recording.id, moduleId);
                setIsCompleted(true);
            }
            onCompletionChange();
        } catch (error) {
            console.error('Error toggling completion:', error);
        } finally {
            setIsToggling(false);
        }
    };

    const embedUrl = getEmbedUrl();

    return (
        <div className="space-y-6">
            {/* Video Player */}
            <div className="bg-black rounded-lg overflow-hidden">
                {embedUrl ? (
                    <div className="relative aspect-video">
                        <iframe
                            src={embedUrl}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={recording.title}
                        />
                    </div>
                ) : (
                    <div className="aspect-video flex items-center justify-center text-surface-400">
                        Video unavailable
                    </div>
                )}
            </div>

            {/* Title & Description */}
            <div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">
                    {recording.title}
                </h2>
                {recording.description && (
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
                        {recording.description}
                    </p>
                )}
            </div>

            {/* Navigation & Complete */}
            <div className="flex items-center gap-3 py-4 border-t border-b border-surface-200 dark:border-surface-700">
                {/* Previous */}
                <button
                    onClick={() => prevRecording && onNavigate(prevRecording.id)}
                    disabled={!prevRecording}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-0"
                >
                    <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate hidden sm:inline">
                        {prevRecording ? prevRecording.title : 'Previous'}
                    </span>
                    <span className="sm:hidden">Prev</span>
                </button>

                {/* Mark Complete */}
                <button
                    onClick={handleToggleComplete}
                    disabled={isToggling}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isCompleted
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                >
                    {isToggling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <Circle className="w-4 h-4" />
                    )}
                    {isCompleted ? 'Completed' : 'Mark Complete'}
                </button>

                {/* Next */}
                <button
                    onClick={() => nextRecording && onNavigate(nextRecording.id)}
                    disabled={!nextRecording}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto min-w-0"
                >
                    <span className="truncate hidden sm:inline">
                        {nextRecording ? nextRecording.title : 'Next'}
                    </span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </button>
            </div>

            {/* Comments Section */}
            {commentSection && (
                <div>
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
                        Discussion
                    </h3>
                    {commentSection}
                </div>
            )}
        </div>
    );
}
