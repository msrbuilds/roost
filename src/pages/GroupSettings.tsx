import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2, AlertTriangle, LayoutGrid, Sidebar as SidebarIcon, GraduationCap, Crown, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getGroupBySlug, updateGroup, deleteGroup, hasPermission } from '@/services/group';
import type { GroupWithDetails } from '@/services/group';
import { GroupMembers, CreateGroupModal } from '@/components/groups';
import type { Group } from '@/types';

export default function GroupSettings() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [group, setGroup] = useState<GroupWithDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingLayout, setIsUpdatingLayout] = useState(false);
    const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchGroup = useCallback(async () => {
        if (!slug) return;

        try {
            setIsLoading(true);
            setError(null);
            const data = await getGroupBySlug(slug, user?.id);
            if (!data) {
                setError('Classroom not found');
            } else if (!hasPermission(data.user_role, 'edit_settings')) {
                setError('You do not have permission to edit this classroom');
            } else {
                setGroup(data);
            }
        } catch (err) {
            console.error('Error fetching group:', err);
            setError('Failed to load classroom');
        } finally {
            setIsLoading(false);
        }
    }, [slug, user?.id]);

    useEffect(() => {
        fetchGroup();
    }, [fetchGroup]);

    const handleEditSuccess = (updatedGroup: Group) => {
        // If slug changed, navigate to new URL
        if (updatedGroup.slug !== slug) {
            navigate(`/classrooms/${updatedGroup.slug}/settings`, { replace: true });
        }
        fetchGroup();
    };

    const handleLayoutChange = async (newLayout: 'default' | 'sidebar' | 'learn') => {
        if (!group) return;

        try {
            setIsUpdatingLayout(true);
            await updateGroup(group.id, { layout_mode: newLayout });
            fetchGroup();
        } catch (err) {
            console.error('Error updating layout:', err);
            alert('Failed to update layout');
        } finally {
            setIsUpdatingLayout(false);
        }
    };

    const handleAccessTypeChange = async (isPremium: boolean) => {
        if (!group) return;

        try {
            setIsUpdatingAccess(true);
            await updateGroup(group.id, { is_premium: isPremium });
            fetchGroup();
        } catch (err) {
            console.error('Error updating access type:', err);
            alert('Failed to update access type');
        } finally {
            setIsUpdatingAccess(false);
        }
    };

    const handleDelete = async () => {
        if (!group || deleteConfirmText !== group.name) return;

        try {
            setIsDeleting(true);
            await deleteGroup(group.id);
            navigate('/classrooms', { replace: true });
        } catch (err) {
            console.error('Error deleting group:', err);
            alert('Failed to delete classroom');
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    if (error || !group) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center py-12">
                    <h2 className="text-xl font-semibold text-surface-900 mb-2">
                        {error || 'Classroom not found'}
                    </h2>
                    <button
                        onClick={() => navigate('/classrooms')}
                        className="mt-4 px-4 py-2 text-primary-600 font-medium hover:bg-primary-50 rounded-lg transition-colors"
                    >
                        Browse Classrooms
                    </button>
                </div>
            </div>
        );
    }

    const canDelete = hasPermission(group.user_role, 'delete_group');

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate(`/classrooms/${group.slug}`)}
                    className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-surface-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Classroom Settings</h1>
                    <p className="text-surface-500">{group.name}</p>
                </div>
            </div>

            <div className="space-y-8">
                {/* General Settings */}
                <section className="card">
                    <div className="p-6 border-b border-surface-100 dark:border-surface-700">
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">General</h2>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                            Manage your classroom's basic information
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            {group.avatar_url ? (
                                <img
                                    src={group.avatar_url}
                                    alt={group.name}
                                    className="w-16 h-16 rounded-xl object-cover"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                                    {group.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1">
                                <h3 className="font-medium text-surface-900 dark:text-surface-100">{group.name}</h3>
                                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                    {group.description || 'No description'}
                                </p>
                                <p className="text-sm text-surface-400 dark:text-surface-500 mt-2">
                                    /classrooms/{group.slug}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="px-4 py-2 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-lg font-medium hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                </section>

                {/* Layout Settings */}
                <section className="card">
                    <div className="p-6 border-b border-surface-100 dark:border-surface-700">
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Layout</h2>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                            Choose the classroom detail page layout
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Default Layout */}
                            <button
                                onClick={() => handleLayoutChange('default')}
                                disabled={isUpdatingLayout}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all text-left
                                    ${group.layout_mode === 'default'
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <LayoutGrid className={`w-5 h-5 mt-0.5 ${group.layout_mode === 'default' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <h3 className={`font-medium ${group.layout_mode === 'default' ? 'text-primary-900 dark:text-primary-100' : 'text-surface-900 dark:text-surface-100'}`}>
                                            Default Layout
                                        </h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                            Header at top, tabs below, content in grid
                                        </p>
                                    </div>
                                </div>
                                {group.layout_mode === 'default' && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>

                            {/* Sidebar Layout */}
                            <button
                                onClick={() => handleLayoutChange('sidebar')}
                                disabled={isUpdatingLayout}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all text-left
                                    ${group.layout_mode === 'sidebar'
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <SidebarIcon className={`w-5 h-5 mt-0.5 ${group.layout_mode === 'sidebar' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <h3 className={`font-medium ${group.layout_mode === 'sidebar' ? 'text-primary-900 dark:text-primary-100' : 'text-surface-900 dark:text-surface-100'}`}>
                                            Sidebar Layout
                                        </h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                            Header in right sidebar, tabs inline with content
                                        </p>
                                    </div>
                                </div>
                                {group.layout_mode === 'sidebar' && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>

                            {/* Learn Mode Layout */}
                            <button
                                onClick={() => handleLayoutChange('learn')}
                                disabled={isUpdatingLayout}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all text-left
                                    ${group.layout_mode === 'learn'
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <GraduationCap className={`w-5 h-5 mt-0.5 ${group.layout_mode === 'learn' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <h3 className={`font-medium ${group.layout_mode === 'learn' ? 'text-primary-900 dark:text-primary-100' : 'text-surface-900 dark:text-surface-100'}`}>
                                            Learn Mode
                                        </h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                            Course-like layout with modules, lessons, and progress tracking
                                        </p>
                                    </div>
                                </div>
                                {group.layout_mode === 'learn' && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Access Type Settings */}
                <section className="card">
                    <div className="p-6 border-b border-surface-100 dark:border-surface-700">
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Access Type</h2>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                            Control who can access this classroom
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Free Access */}
                            <button
                                onClick={() => handleAccessTypeChange(false)}
                                disabled={isUpdatingAccess}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all text-left
                                    ${!group.is_premium
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <Users className={`w-5 h-5 mt-0.5 ${!group.is_premium ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <h3 className={`font-medium ${!group.is_premium ? 'text-primary-900 dark:text-primary-100' : 'text-surface-900 dark:text-surface-100'}`}>
                                            Free Access
                                        </h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                            All members can join this classroom
                                        </p>
                                    </div>
                                </div>
                                {!group.is_premium && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>

                            {/* Premium Only */}
                            <button
                                onClick={() => handleAccessTypeChange(true)}
                                disabled={isUpdatingAccess}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all text-left
                                    ${group.is_premium
                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <Crown className={`w-5 h-5 mt-0.5 ${group.is_premium ? 'text-amber-600 dark:text-amber-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <h3 className={`font-medium ${group.is_premium ? 'text-amber-900 dark:text-amber-100' : 'text-surface-900 dark:text-surface-100'}`}>
                                            Premium Only
                                        </h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                            Only premium members can access
                                        </p>
                                    </div>
                                </div>
                                {group.is_premium && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Members Management */}
                <section>
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Members</h2>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                            Manage classroom members and their roles
                        </p>
                    </div>
                    <GroupMembers
                        groupId={group.id}
                        userRole={group.user_role}
                        compact={false}
                        limit={50}
                        onMemberChange={fetchGroup}
                    />
                </section>

                {/* Danger Zone */}
                {canDelete && (
                    <section className="card border-red-200 dark:border-red-900">
                        <div className="p-6 border-b border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20">
                            <h2 className="text-lg font-semibold text-red-900 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Danger Zone
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-medium text-surface-900 dark:text-surface-100">Delete this classroom</h3>
                                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                        Once you delete a classroom, there is no going back. All posts, comments, and member data will be permanently deleted.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2 flex-shrink-0"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Classroom
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {/* Edit Modal */}
            <CreateGroupModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={handleEditSuccess}
                editingGroup={group}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertTriangle className="w-6 h-6" />
                            <h2 className="text-xl font-semibold">Delete Classroom</h2>
                        </div>
                        <p className="text-surface-600 mb-4">
                            This action cannot be undone. This will permanently delete the
                            <strong> {group.name} </strong>
                            classroom and all of its content.
                        </p>
                        <p className="text-surface-600 mb-4">
                            Please type <strong>{group.name}</strong> to confirm.
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={group.name}
                            className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmText('');
                                }}
                                className="flex-1 px-4 py-2.5 border border-surface-200 rounded-lg text-surface-700 font-medium hover:bg-surface-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteConfirmText !== group.name || isDeleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Delete Classroom
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
