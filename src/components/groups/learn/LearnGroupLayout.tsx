import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { GroupWithDetails } from '@/services/group';
import type { TabValue } from '@/components/groups/GroupTabs';
import type { ModuleWithProgress, RecordingWithCompletion, Module } from '@/types';
import {
    getModulesWithProgress,
    getModuleRecordings,
    getRecordingById,
    getAdjacentRecordings,
    deleteModule,
} from '@/services/module';
import CompactGroupHeader from './CompactGroupHeader';
import LearnSidebar from './LearnSidebar';
import ModuleGrid from './ModuleGrid';
import ModuleDetail from './ModuleDetail';
import LessonPlayer from './LessonPlayer';
import ManageModuleModal from './ManageModuleModal';
import { AddRecordingModal, UploadAssetsModal } from '@/components/groups';
import CommentSection from '@/components/feed/CommentSection';

interface LearnGroupLayoutProps {
    group: GroupWithDetails;
    canViewContent: boolean;
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
    onJoin: () => void;
    onLeave: () => void;
    isJoining: boolean;
    isLeaving: boolean;
    onMemberChange: () => void;
}

export default function LearnGroupLayout({
    group,
    canViewContent,
}: LearnGroupLayoutProps) {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // State
    const [modules, setModules] = useState<ModuleWithProgress[]>([]);
    const [moduleRecordings, setModuleRecordings] = useState<Record<string, RecordingWithCompletion[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Current view state from URL params
    const activeModuleId = searchParams.get('module') || undefined;
    const activeRecordingId = searchParams.get('lesson') || undefined;

    // Active module/recording data
    const [activeModule, setActiveModule] = useState<ModuleWithProgress | null>(null);
    const [activeRecording, setActiveRecording] = useState<RecordingWithCompletion | null>(null);
    const [adjacentRecordings, setAdjacentRecordings] = useState<{
        prev: { id: string; title: string } | null;
        next: { id: string; title: string } | null;
    }>({ prev: null, next: null });

    // Modals
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [showRecordingModal, setShowRecordingModal] = useState(false);
    const [showAssetModal, setShowAssetModal] = useState(false);

    // Determine view
    const view = activeRecordingId ? 'lesson' : activeModuleId ? 'module' : 'grid';

    // Fetch modules
    const loadModules = useCallback(async () => {
        if (!user) return;
        try {
            setIsLoading(true);
            const data = await getModulesWithProgress(group.id, user.id);
            setModules(data);

            // Load recordings for all modules (for sidebar)
            const recordingsMap: Record<string, RecordingWithCompletion[]> = {};
            await Promise.all(
                data.map(async (mod) => {
                    const recs = await getModuleRecordings(mod.id, user.id);
                    recordingsMap[mod.id] = recs;
                })
            );
            setModuleRecordings(recordingsMap);
        } catch (error) {
            console.error('Error loading modules:', error);
        } finally {
            setIsLoading(false);
        }
    }, [group.id, user]);

    useEffect(() => {
        if (canViewContent) {
            loadModules();
        }
    }, [canViewContent, loadModules]);

    // Load active module detail when URL changes
    useEffect(() => {
        if (activeModuleId && modules.length > 0) {
            const mod = modules.find((m) => m.id === activeModuleId);
            setActiveModule(mod || null);
        } else {
            setActiveModule(null);
        }
    }, [activeModuleId, modules]);

    // Load active recording when URL changes
    useEffect(() => {
        if (activeRecordingId && activeModuleId && user) {
            loadActiveRecording(activeRecordingId, activeModuleId);
        } else {
            setActiveRecording(null);
            setAdjacentRecordings({ prev: null, next: null });
        }
    }, [activeRecordingId, activeModuleId, user]);

    const loadActiveRecording = async (recordingId: string, moduleId: string) => {
        try {
            const [recording, adjacent] = await Promise.all([
                getRecordingById(recordingId),
                getAdjacentRecordings(recordingId, moduleId),
            ]);

            if (recording) {
                // Check completion status from sidebar data
                const modRecs = moduleRecordings[moduleId] || [];
                const recWithCompletion = modRecs.find((r) => r.id === recordingId);
                setActiveRecording({
                    ...recording,
                    is_completed: recWithCompletion?.is_completed || false,
                });
            }
            setAdjacentRecordings(adjacent);
        } catch (error) {
            console.error('Error loading recording:', error);
        }
    };

    // Navigation handlers
    const navigateToModule = (moduleId: string) => {
        setSearchParams({ module: moduleId });
    };

    const navigateToLesson = (moduleId: string, recordingId: string) => {
        setSearchParams({ module: moduleId, lesson: recordingId });
    };

    const navigateToGrid = () => {
        setSearchParams({});
    };

    const handleLessonNavigate = (recordingId: string) => {
        if (activeModuleId) {
            navigateToLesson(activeModuleId, recordingId);
        }
    };

    // Module management
    const handleAddModule = () => {
        setEditingModule(null);
        setShowModuleModal(true);
    };

    const handleEditModule = () => {
        if (activeModule) {
            setEditingModule(activeModule);
            setShowModuleModal(true);
        }
    };

    const handleDeleteModule = async () => {
        if (!activeModule) return;
        if (!confirm(`Are you sure you want to delete the module "${activeModule.title}"? This will unassign all recordings and assets.`)) return;

        try {
            await deleteModule(activeModule.id);
            navigateToGrid();
            loadModules();
        } catch (error) {
            console.error('Error deleting module:', error);
            alert('Failed to delete module');
        }
    };

    const handleModuleModalSuccess = () => {
        setShowModuleModal(false);
        setEditingModule(null);
        loadModules();
    };

    const handleCompletionChange = () => {
        // Refresh all data after completion toggle
        loadModules();
    };

    if (!canViewContent) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-surface-400 dark:text-surface-500" />
                    </div>
                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-50 mb-2">
                        This is a private classroom
                    </h3>
                    <p className="text-surface-500 dark:text-surface-400 max-w-md mx-auto">
                        You need to be a member to see the content of this classroom.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading && modules.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)]">
            {/* Left Sidebar */}
            <LearnSidebar
                modules={modules}
                moduleRecordings={moduleRecordings}
                activeModuleId={activeModuleId}
                activeRecordingId={activeRecordingId}
                onSelectModule={navigateToModule}
                onSelectLesson={navigateToLesson}
                onBackToModules={navigateToGrid}
                showBackButton={view !== 'grid'}
            />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                {/* Compact Header */}
                <CompactGroupHeader group={group} />

                {/* Content */}
                <div className="p-6">
                    {view === 'grid' && (
                        <ModuleGrid
                            modules={modules}
                            isLoading={isLoading}
                            userRole={group.user_role}
                            onModuleClick={navigateToModule}
                            onAddModule={handleAddModule}
                        />
                    )}

                    {view === 'module' && activeModule && (
                        <ModuleDetail
                            module={activeModule}
                            userRole={group.user_role}
                            onLessonClick={(recId) => navigateToLesson(activeModule.id, recId)}
                            onBack={navigateToGrid}
                            onAddRecording={() => setShowRecordingModal(true)}
                            onAddAsset={() => setShowAssetModal(true)}
                            onEditModule={handleEditModule}
                            onDeleteModule={handleDeleteModule}
                        />
                    )}

                    {view === 'lesson' && activeRecording && activeModuleId && user && (
                        <LessonPlayer
                            recording={activeRecording}
                            moduleId={activeModuleId}
                            userId={user.id}
                            prevRecording={adjacentRecordings.prev}
                            nextRecording={adjacentRecordings.next}
                            onNavigate={handleLessonNavigate}
                            onCompletionChange={handleCompletionChange}
                            commentSection={
                                <CommentSection
                                    recordingId={activeRecording.id}
                                    commentCount={0}
                                    isExpanded={true}
                                />
                            }
                        />
                    )}
                </div>
            </main>

            {/* Modals */}
            <ManageModuleModal
                isOpen={showModuleModal}
                groupId={group.id}
                onClose={() => {
                    setShowModuleModal(false);
                    setEditingModule(null);
                }}
                onSuccess={handleModuleModalSuccess}
                editingModule={editingModule}
                nextOrder={modules.length}
            />

            <AddRecordingModal
                isOpen={showRecordingModal}
                groupId={group.id}
                moduleId={activeModuleId}
                onClose={() => setShowRecordingModal(false)}
                onSuccess={() => {
                    setShowRecordingModal(false);
                    loadModules();
                }}
            />

            <UploadAssetsModal
                isOpen={showAssetModal}
                groupId={group.id}
                moduleId={activeModuleId}
                onClose={() => setShowAssetModal(false)}
                onSuccess={() => {
                    setShowAssetModal(false);
                    loadModules();
                }}
            />
        </div>
    );
}
