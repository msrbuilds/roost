import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, ArrowLeft, Menu, X } from 'lucide-react';
import type { ModuleWithProgress, RecordingWithCompletion } from '@/types';
import ProgressBar from './ProgressBar';

interface LearnSidebarProps {
    modules: ModuleWithProgress[];
    moduleRecordings: Record<string, RecordingWithCompletion[]>;
    activeModuleId?: string;
    activeRecordingId?: string;
    onSelectModule: (moduleId: string) => void;
    onSelectLesson: (moduleId: string, recordingId: string) => void;
    onBackToModules: () => void;
    showBackButton: boolean;
}

export default function LearnSidebar({
    modules,
    moduleRecordings,
    activeModuleId,
    activeRecordingId,
    onSelectModule,
    onSelectLesson,
    onBackToModules,
    showBackButton,
}: LearnSidebarProps) {
    const [expandedModules, setExpandedModules] = useState<Set<string>>(
        new Set(activeModuleId ? [activeModuleId] : [])
    );
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const toggleModule = (moduleId: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    };

    const handleLessonClick = (moduleId: string, recordingId: string) => {
        onSelectLesson(moduleId, recordingId);
        setIsMobileOpen(false);
    };

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Back button */}
            {showBackButton && (
                <button
                    onClick={() => {
                        onBackToModules();
                        setIsMobileOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-surface-50 dark:hover:bg-surface-800 border-b border-surface-200 dark:border-surface-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Modules
                </button>
            )}

            {/* Module list */}
            <div className="flex-1 overflow-y-auto">
                {modules.map((module) => {
                    const isExpanded = expandedModules.has(module.id);
                    const recordings = moduleRecordings[module.id] || [];
                    const isActive = module.id === activeModuleId;

                    return (
                        <div key={module.id} className="border-b border-surface-100 dark:border-surface-800">
                            {/* Module header */}
                            <button
                                onClick={() => {
                                    toggleModule(module.id);
                                    onSelectModule(module.id);
                                    setIsMobileOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                                    isActive ? 'bg-surface-50 dark:bg-surface-800/50' : ''
                                }`}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-surface-400 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                                        {module.title}
                                    </h3>
                                    <div className="mt-1">
                                        <ProgressBar value={module.progress_percentage} size="sm" />
                                    </div>
                                </div>
                            </button>

                            {/* Lessons */}
                            {isExpanded && recordings.length > 0 && (
                                <div className="pb-2">
                                    {recordings.map((recording) => {
                                        const isActiveLesson = recording.id === activeRecordingId;
                                        return (
                                            <button
                                                key={recording.id}
                                                onClick={() => handleLessonClick(module.id, recording.id)}
                                                className={`w-full flex items-center gap-2.5 pl-10 pr-4 py-2 text-left transition-colors ${
                                                    isActiveLesson
                                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                                        : 'hover:bg-surface-50 dark:hover:bg-surface-800/50 text-surface-600 dark:text-surface-400'
                                                }`}
                                            >
                                                {recording.is_completed ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <Circle className="w-4 h-4 text-surface-300 dark:text-surface-600 flex-shrink-0" />
                                                )}
                                                <span className="text-sm truncate">
                                                    {recording.title}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {isExpanded && recordings.length === 0 && (
                                <p className="text-xs text-surface-400 dark:text-surface-500 pl-10 pr-4 pb-3">
                                    No lessons yet
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile toggle button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
            >
                {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:sticky top-0 left-0 z-40 lg:z-auto
                    w-72 h-full lg:h-[calc(100vh-4rem)]
                    bg-white dark:bg-surface-900
                    border-r border-surface-200 dark:border-surface-700
                    transition-transform duration-300 lg:transition-none
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    overflow-hidden flex-shrink-0
                `}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
