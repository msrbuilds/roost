import { useState, useEffect } from 'react';
import { ArrowLeft, Video, FileText, Plus, CheckCircle2, Circle, Play, Loader2, Edit2, Trash2 } from 'lucide-react';
import type { ModuleWithProgress, RecordingWithCompletion, GroupAssetWithDetails, GroupRole } from '@/types';
import { getModuleRecordings, getModuleAssets } from '@/services/module';
import { useAuth } from '@/contexts/AuthContext';
import ProgressBar from './ProgressBar';

interface ModuleDetailProps {
    module: ModuleWithProgress;
    userRole: GroupRole | null;
    onLessonClick: (recordingId: string) => void;
    onBack: () => void;
    onAddRecording: () => void;
    onAddAsset: () => void;
    onEditModule: () => void;
    onDeleteModule: () => void;
}

type TabValue = 'recordings' | 'assets';

export default function ModuleDetail({
    module,
    userRole,
    onLessonClick,
    onBack,
    onAddRecording,
    onAddAsset,
    onEditModule,
    onDeleteModule,
}: ModuleDetailProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabValue>('recordings');
    const [recordings, setRecordings] = useState<RecordingWithCompletion[]>([]);
    const [assets, setAssets] = useState<GroupAssetWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const canManage = userRole && (userRole === 'admin' || userRole === 'moderator');

    useEffect(() => {
        loadContent();
    }, [module.id]);

    const loadContent = async () => {
        try {
            setIsLoading(true);
            const [recs, assetData] = await Promise.all([
                getModuleRecordings(module.id, user?.id),
                getModuleAssets(module.id),
            ]);
            setRecordings(recs);
            setAssets(assetData);
        } catch (error) {
            console.error('Error loading module content:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getThumbnailUrl = (platform: string, videoId: string) => {
        if (platform === 'youtube') {
            return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        } else if (platform === 'vimeo') {
            return `https://vumbnail.com/${videoId}.jpg`;
        }
        return null;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getFileIcon = (mimeType: string | null) => {
        if (!mimeType) return FileText;
        if (mimeType.startsWith('image/')) return FileText;
        if (mimeType.startsWith('video/')) return Video;
        return FileText;
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <button
                    onClick={onBack}
                    className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors mt-0.5"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">
                        {module.title}
                    </h2>
                    {module.description && (
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                            {module.description}
                        </p>
                    )}
                    <div className="mt-3 max-w-xs">
                        <ProgressBar value={module.progress_percentage} size="md" showLabel />
                    </div>
                </div>
                {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={onEditModule}
                            className="p-2 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title="Edit module"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onDeleteModule}
                            className="p-2 text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete module"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => setActiveTab('recordings')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'recordings'
                            ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                    }`}
                >
                    <Video className="w-4 h-4" />
                    Recordings ({recordings.length})
                </button>
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'assets'
                            ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Assets ({assets.length})
                </button>

                {/* Add buttons */}
                {canManage && (
                    <div className="ml-auto flex items-center gap-2">
                        {activeTab === 'recordings' && (
                            <button
                                onClick={onAddRecording}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Recording
                            </button>
                        )}
                        {activeTab === 'assets' && (
                            <button
                                onClick={onAddAsset}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Upload Asset
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            ) : activeTab === 'recordings' ? (
                recordings.length === 0 ? (
                    <div className="text-center py-12 bg-surface-50 dark:bg-surface-900 rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700">
                        <Video className="w-10 h-10 mx-auto text-surface-400 dark:text-surface-500 mb-3" />
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                            No recordings in this module yet
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
                        {recordings.map((recording) => {
                            const thumbnailUrl = getThumbnailUrl(recording.video_platform, recording.video_id);
                            return (
                                <button
                                    key={recording.id}
                                    onClick={() => onLessonClick(recording.id)}
                                    className="w-full flex items-center gap-3 py-3 px-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors text-left"
                                >
                                    {/* Completion icon */}
                                    {recording.is_completed ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-surface-300 dark:text-surface-600 flex-shrink-0" />
                                    )}

                                    {/* Thumbnail */}
                                    <div className="relative flex-shrink-0 w-24 h-14 rounded overflow-hidden bg-surface-900 dark:bg-surface-800">
                                        {thumbnailUrl && (
                                            <img
                                                src={thumbnailUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Play className="w-5 h-5 text-white/80" fill="currentColor" />
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-surface-900 dark:text-surface-50 line-clamp-1">
                                            {recording.title}
                                        </h4>
                                        {recording.description && (
                                            <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-1 mt-0.5">
                                                {recording.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Date */}
                                    <span className="text-xs text-surface-400 dark:text-surface-500 flex-shrink-0">
                                        {recording.created_at && formatDate(recording.created_at)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )
            ) : (
                // Assets tab
                assets.length === 0 ? (
                    <div className="text-center py-12 bg-surface-50 dark:bg-surface-900 rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700">
                        <FileText className="w-10 h-10 mx-auto text-surface-400 dark:text-surface-500 mb-3" />
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                            No assets in this module yet
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
                        {assets.map((asset) => {
                            const Icon = getFileIcon(asset.mime_type);
                            return (
                                <div
                                    key={asset.id}
                                    className="flex items-center gap-3 py-3 px-4"
                                >
                                    <Icon className="w-5 h-5 text-surface-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={asset.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-surface-900 dark:text-surface-50 hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                                        >
                                            {asset.filename}
                                        </a>
                                        <p className="text-xs text-surface-400 dark:text-surface-500">
                                            {formatFileSize(asset.file_size)}
                                            {asset.created_at && ` · ${formatDate(asset.created_at)}`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
