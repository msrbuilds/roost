import { useState, useEffect, useMemo } from 'react';
import { Plus, Video, Loader2, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getGroupRecordings } from '@/services/group';
import type { GroupRole } from '@/types';
import RecordingCard from './RecordingCard';
import AddRecordingModal from './AddRecordingModal';

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc';

const ITEMS_PER_PAGE = 10;

interface GroupRecordingsProps {
    groupId: string;
    userRole: GroupRole | null;
}

export default function GroupRecordings({ groupId, userRole }: GroupRecordingsProps) {
    const [recordings, setRecordings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRecording, setEditingRecording] = useState<any | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [currentPage, setCurrentPage] = useState(1);

    const canPublish = userRole && (userRole === 'admin' || userRole === 'moderator');

    useEffect(() => {
        loadRecordings();
    }, [groupId]);

    const loadRecordings = async () => {
        try {
            setIsLoading(true);
            const data = await getGroupRecordings(groupId);
            setRecordings(data);
        } catch (error) {
            console.error('Error loading recordings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const sortedRecordings = useMemo(() => {
        const sorted = [...recordings];
        switch (sortBy) {
            case 'newest':
                return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            case 'oldest':
                return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            case 'title_asc':
                return sorted.sort((a, b) => a.title.localeCompare(b.title));
            case 'title_desc':
                return sorted.sort((a, b) => b.title.localeCompare(a.title));
            default:
                return sorted;
        }
    }, [recordings, sortBy]);

    // Pagination calculations
    const totalPages = Math.ceil(sortedRecordings.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedRecordings = sortedRecordings.slice(startIndex, endIndex);

    // Reset to page 1 when sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [sortBy]);

    const handleRecordingDeleted = (id: string) => {
        setRecordings((prev) => {
            const filtered = prev.filter((r) => r.id !== id);
            // Adjust current page if we deleted the last item on current page
            const newTotalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages);
            }
            return filtered;
        });
    };

    const handleEditRecording = (recording: any) => {
        setEditingRecording(recording);
        setShowAddModal(true);
    };

    const handleModalClose = () => {
        setShowAddModal(false);
        setEditingRecording(null);
    };

    const handleModalSuccess = () => {
        loadRecordings();
        handleModalClose();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="p-2 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Recordings</h2>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                        {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'} available
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Sort dropdown */}
                    {recordings.length > 1 && (
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="appearance-none pl-3 pr-8 py-2 text-sm border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                            >
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="title_asc">Title A-Z</option>
                                <option value="title_desc">Title Z-A</option>
                            </select>
                            <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
                        </div>
                    )}
                    {canPublish && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Recording
                        </button>
                    )}
                </div>
            </div>

            {/* Recordings List */}
            {recordings.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 dark:bg-surface-900 rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700">
                    <Video className="w-12 h-12 mx-auto text-surface-400 dark:text-surface-500 mb-3" />
                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-50 mb-1">No recordings yet</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                        {canPublish
                            ? 'Share YouTube or Vimeo videos with your students.'
                            : 'Course recordings will appear here when published by instructors.'}
                    </p>
                    {canPublish && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Your First Recording
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
                        {paginatedRecordings.map((recording) => (
                            <RecordingCard
                                key={recording.id}
                                recording={recording}
                                canEdit={canPublish || false}
                                onDeleted={handleRecordingDeleted}
                                onEdit={handleEditRecording}
                            />
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                            <p className="text-sm text-surface-500 dark:text-surface-400">
                                Showing {startIndex + 1}-{Math.min(endIndex, sortedRecordings.length)} of {sortedRecordings.length} recordings
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                                                currentPage === page
                                                    ? 'bg-primary-600 text-white'
                                                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Add/Edit Recording Modal */}
            <AddRecordingModal
                isOpen={showAddModal}
                groupId={groupId}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                editingRecording={editingRecording}
            />
        </div>
    );
}
