import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Loader2,
    Search,
    CheckCircle,
    XCircle,
    Star,
    ExternalLink,
    Eye,
    ChevronUp,
    MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getShowcasesForModeration,
    getShowcaseStats,
    approveShowcase,
    rejectShowcase,
    featureShowcase,
    unfeatureShowcase,
} from '@/services/showcase';
import type { ShowcaseForModeration, ShowcaseStats } from '@/types/showcase';
import type { ShowcaseStatus } from '@/types/database';
import { SHOWCASE_CATEGORY_INFO, SHOWCASE_STATUS_INFO } from '@/types/showcase';

const TABS: { value: ShowcaseStatus | 'all'; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'featured', label: 'Featured' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
];

export default function AdminShowcases() {
    const { user } = useAuth();
    const [showcases, setShowcases] = useState<ShowcaseForModeration[]>([]);
    const [stats, setStats] = useState<ShowcaseStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ShowcaseStatus | 'all'>('pending');
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Modal state
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingShowcaseId, setRejectingShowcaseId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [showcasesData, statsData] = await Promise.all([
                getShowcasesForModeration(activeTab === 'all' ? undefined : activeTab, search || undefined),
                getShowcaseStats(),
            ]);
            setShowcases(showcasesData);
            setStats(statsData);
        } catch (error) {
            console.error('Error fetching showcases:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, search, user?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== '') {
                fetchData();
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [search]);

    // Action handlers
    const handleApprove = async (showcaseId: string) => {
        if (!user) return;
        setActionLoading(showcaseId);
        try {
            await approveShowcase(showcaseId, user.id);
            fetchData();
        } catch (error) {
            console.error('Error approving showcase:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!user || !rejectingShowcaseId || !rejectReason.trim()) return;
        setActionLoading(rejectingShowcaseId);
        try {
            await rejectShowcase(rejectingShowcaseId, user.id, rejectReason);
            setRejectModalOpen(false);
            setRejectingShowcaseId(null);
            setRejectReason('');
            fetchData();
        } catch (error) {
            console.error('Error rejecting showcase:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleFeature = async (showcaseId: string) => {
        if (!user) return;
        setActionLoading(showcaseId);
        try {
            await featureShowcase(showcaseId, user.id);
            fetchData();
        } catch (error) {
            console.error('Error featuring showcase:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnfeature = async (showcaseId: string) => {
        setActionLoading(showcaseId);
        try {
            await unfeatureShowcase(showcaseId);
            fetchData();
        } catch (error) {
            console.error('Error unfeaturing showcase:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const openRejectModal = (showcaseId: string) => {
        setRejectingShowcaseId(showcaseId);
        setRejectModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                    Showcase Moderation
                </h1>
                <p className="text-surface-500 dark:text-surface-400 mt-1">
                    Review and manage showcase submissions
                </p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-surface-500 dark:text-surface-400">Total</p>
                        <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{stats.total}</p>
                    </div>
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-yellow-600">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                    </div>
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-green-600">Approved</p>
                        <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                    </div>
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-purple-600">Featured</p>
                        <p className="text-2xl font-bold text-purple-600">{stats.featured}</p>
                    </div>
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-red-600">Rejected</p>
                        <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                    </div>
                    <div className="card shadow-none p-4">
                        <p className="text-sm text-surface-500 dark:text-surface-400">This Month</p>
                        <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{stats.thisMonth}</p>
                    </div>
                </div>
            )}

            {/* Tabs and Search */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex gap-1 overflow-x-auto pb-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => setActiveTab(tab.value)}
                            className={`
                                px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                                ${activeTab === tab.value
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                                }
                            `}
                        >
                            {tab.label}
                            {tab.value === 'pending' && stats?.pending ? (
                                <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                                    {stats.pending}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search showcases..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
            </div>

            {/* Showcases List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            ) : showcases.length === 0 ? (
                <div className="text-center py-12 text-surface-500 dark:text-surface-400">
                    No showcases found
                </div>
            ) : (
                <div className="card shadow-none overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-surface-50 dark:bg-surface-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Project
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Author
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Stats
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Submitted
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                                {showcases.map((showcase) => {
                                    const categoryInfo = SHOWCASE_CATEGORY_INFO[showcase.category];
                                    const statusInfo = SHOWCASE_STATUS_INFO[showcase.status];
                                    const isActionLoading = actionLoading === showcase.id;

                                    return (
                                        <tr key={showcase.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    {showcase.thumbnail_url && (
                                                        <img
                                                            src={showcase.thumbnail_url}
                                                            alt=""
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                    )}
                                                    <Link
                                                        to={`/showcase/${showcase.id}`}
                                                        className="font-medium text-surface-900 dark:text-surface-100 hover:text-primary-600"
                                                    >
                                                        {showcase.title}
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Link
                                                    to={`/profile/${showcase.author.username}`}
                                                    className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400 hover:text-primary-600"
                                                >
                                                    {showcase.author.avatar_url ? (
                                                        <img
                                                            src={showcase.author.avatar_url}
                                                            alt=""
                                                            className="w-6 h-6 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-surface-200 dark:bg-surface-700" />
                                                    )}
                                                    {showcase.author.username}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span
                                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                                    style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}
                                                >
                                                    {categoryInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3 text-sm text-surface-500">
                                                    <span className="flex items-center gap-1">
                                                        <ChevronUp className="w-4 h-4" />
                                                        {showcase.vote_count}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-4 h-4" />
                                                        {showcase.review_count}
                                                    </span>
                                                    {showcase.average_rating > 0 && (
                                                        <span className="flex items-center gap-1 text-amber-500">
                                                            <Star className="w-4 h-4 fill-current" />
                                                            {showcase.average_rating.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-surface-500">
                                                {new Date(showcase.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <a
                                                        href={showcase.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"
                                                        title="Visit project"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    <Link
                                                        to={`/showcase/${showcase.id}`}
                                                        className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>

                                                    {showcase.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(showcase.id)}
                                                                disabled={isActionLoading}
                                                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50"
                                                                title="Approve"
                                                            >
                                                                {isActionLoading ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => openRejectModal(showcase.id)}
                                                                disabled={isActionLoading}
                                                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                                                                title="Reject"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {showcase.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleFeature(showcase.id)}
                                                            disabled={isActionLoading}
                                                            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg disabled:opacity-50"
                                                            title="Feature"
                                                        >
                                                            {isActionLoading ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Star className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}

                                                    {showcase.status === 'featured' && (
                                                        <button
                                                            onClick={() => handleUnfeature(showcase.id)}
                                                            disabled={isActionLoading}
                                                            className="p-2 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg disabled:opacity-50"
                                                            title="Unfeature"
                                                        >
                                                            {isActionLoading ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Star className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
                            Reject Showcase
                        </h3>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                            Please provide a reason for rejection. This will be visible to the author.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            rows={4}
                            className="w-full px-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setRejectModalOpen(false);
                                    setRejectingShowcaseId(null);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectReason.trim() || actionLoading !== null}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
