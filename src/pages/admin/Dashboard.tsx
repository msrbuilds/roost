import { useEffect, useState } from 'react';
import {
    Users,
    FileText,
    MessageSquare,
    Calendar,
    TrendingUp,
    Award,
    Megaphone,
    RefreshCw,
} from 'lucide-react';
import { StatsCard } from '../../components/admin';
import {
    getDashboardStats,
    getUserGrowth,
    getActivityStats,
    getTopContributors,
} from '../../services';
import type { AdminStats, UserGrowthData, ActivityStatsData } from '../../services';

interface TopContributor {
    user: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
    points: number;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [userGrowth, setUserGrowth] = useState<UserGrowthData[]>([]);
    const [activityStats, setActivityStats] = useState<ActivityStatsData[]>([]);
    const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsData, growth, activity, contributors] = await Promise.all([
                getDashboardStats(),
                getUserGrowth(30),
                getActivityStats(30),
                getTopContributors(5),
            ]);
            setStats(statsData);
            setUserGrowth(growth);
            setActivityStats(activity);
            setTopContributors(contributors as TopContributor[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
                <p className="font-medium">Error loading dashboard</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                    onClick={loadData}
                    className="mt-3 text-sm font-medium underline hover:no-underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your community</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Members"
                    value={stats?.total_members || 0}
                    icon={Users}
                    color="blue"
                    trend={{
                        value: stats?.new_members_30d || 0,
                        label: 'new this month',
                        isPositive: true,
                    }}
                />
                <StatsCard
                    title="Total Posts"
                    value={stats?.total_posts || 0}
                    icon={FileText}
                    color="purple"
                    trend={{
                        value: stats?.posts_30d || 0,
                        label: 'this month',
                        isPositive: true,
                    }}
                />
                <StatsCard
                    title="Total Comments"
                    value={stats?.total_comments || 0}
                    icon={MessageSquare}
                    color="green"
                    trend={{
                        value: stats?.comments_30d || 0,
                        label: 'this month',
                        isPositive: true,
                    }}
                />
                <StatsCard
                    title="Upcoming Events"
                    value={stats?.upcoming_events || 0}
                    icon={Calendar}
                    color="orange"
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Active Groups"
                    value={`${stats?.active_groups || 0} / ${stats?.total_groups || 0}`}
                    icon={TrendingUp}
                    color="indigo"
                />
                <StatsCard
                    title="Active Announcements"
                    value={stats?.active_announcements || 0}
                    icon={Megaphone}
                    color="orange"
                />
                <StatsCard
                    title="Banned Users"
                    value={stats?.banned_members || 0}
                    icon={Users}
                    color="red"
                />
            </div>

            {/* Charts and Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Chart Placeholder */}
                <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Activity (Last 30 Days)</h3>
                    <div className="space-y-3">
                        {activityStats.slice(-7).map((day) => (
                            <div key={day.date} className="flex items-center gap-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400 w-24">
                                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                <div className="flex-1 flex gap-2">
                                    <div
                                        className="h-6 bg-primary-500 rounded"
                                        style={{ width: `${Math.min(day.posts * 10, 100)}%` }}
                                        title={`${day.posts} posts`}
                                    />
                                    <div
                                        className="h-6 bg-green-500 rounded"
                                        style={{ width: `${Math.min(day.comments * 5, 100)}%` }}
                                        title={`${day.comments} comments`}
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-4 text-sm mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-primary-500 rounded" />
                                <span className="text-gray-600 dark:text-gray-400">Posts</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded" />
                                <span className="text-gray-600 dark:text-gray-400">Comments</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Contributors */}
                <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Contributors</h3>
                    </div>
                    <div className="space-y-4">
                        {topContributors.map((contributor, index) => (
                            <div key={`${contributor.user.id}-${index}`} className="flex items-center gap-3">
                                <span className="text-lg font-bold text-gray-400 dark:text-gray-500 w-6">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                                </span>
                                <img
                                    src={contributor.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.user.display_name)}`}
                                    alt={contributor.user.display_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {contributor.user.display_name}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">@{contributor.user.username}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-primary-600 dark:text-primary-400">{contributor.points}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">points</p>
                                </div>
                            </div>
                        ))}
                        {topContributors.length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No contributors yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* User Growth */}
            <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Members (Last 30 Days)</h3>
                <div className="flex items-end gap-1 h-32">
                    {userGrowth.map((day) => {
                        const maxCount = Math.max(...userGrowth.map((d) => d.count), 1);
                        const height = (day.count / maxCount) * 100;
                        return (
                            <div
                                key={day.date}
                                className="flex-1 bg-primary-500 rounded-t hover:bg-primary-600 transition-colors cursor-pointer"
                                style={{ height: `${Math.max(height, 4)}%` }}
                                title={`${new Date(day.date).toLocaleDateString()}: ${day.count} new members`}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>30 days ago</span>
                    <span>Today</span>
                </div>
            </div>
        </div>
    );
}
