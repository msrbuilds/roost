import { Plus, BookOpen, Loader2 } from 'lucide-react';
import type { ModuleWithProgress } from '@/types';
import type { GroupRole } from '@/types';
import ModuleCard from './ModuleCard';

interface ModuleGridProps {
    modules: ModuleWithProgress[];
    isLoading: boolean;
    userRole: GroupRole | null;
    onModuleClick: (moduleId: string) => void;
    onAddModule: () => void;
}

export default function ModuleGrid({
    modules,
    isLoading,
    userRole,
    onModuleClick,
    onAddModule,
}: ModuleGridProps) {
    const canManage = userRole && (userRole === 'admin' || userRole === 'moderator');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">Modules</h2>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                        {modules.length} {modules.length === 1 ? 'module' : 'modules'} available
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={onAddModule}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Module
                    </button>
                )}
            </div>

            {/* Grid */}
            {modules.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 dark:bg-surface-900 rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700">
                    <BookOpen className="w-12 h-12 mx-auto text-surface-400 dark:text-surface-500 mb-3" />
                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-50 mb-1">
                        No modules yet
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                        {canManage
                            ? 'Create modules to organize your course content.'
                            : 'Course modules will appear here when published by instructors.'}
                    </p>
                    {canManage && (
                        <button
                            onClick={onAddModule}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Your First Module
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((module) => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            onClick={onModuleClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
