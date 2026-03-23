import { Video } from 'lucide-react';
import type { ModuleWithProgress } from '@/types';
import ProgressBar from './ProgressBar';

interface ModuleCardProps {
    module: ModuleWithProgress;
    onClick: (moduleId: string) => void;
}

export default function ModuleCard({ module, onClick }: ModuleCardProps) {
    return (
        <button
            onClick={() => onClick(module.id)}
            className="card overflow-hidden text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors w-full"
        >
            {/* Thumbnail */}
            <div className="relative w-full h-40 bg-gradient-to-br from-surface-800 to-surface-900 overflow-hidden">
                {module.thumbnail_url ? (
                    <img
                        src={module.thumbnail_url}
                        alt={module.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-10 h-10 text-surface-500" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <h3 className="font-semibold text-surface-900 dark:text-surface-50 line-clamp-1">
                    {module.title}
                </h3>
                {module.description && (
                    <p className="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">
                        {module.description}
                    </p>
                )}

                {/* Progress */}
                <div className="space-y-1.5">
                    <ProgressBar value={module.progress_percentage} size="md" />
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                        {module.progress_percentage}%
                        {module.recording_count > 0 && (
                            <span className="ml-1">
                                · {module.completed_count}/{module.recording_count} lessons
                            </span>
                        )}
                    </p>
                </div>
            </div>
        </button>
    );
}
