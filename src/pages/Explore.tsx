import { useState, useEffect, useCallback } from 'react';
import { getMembersCount, getOnlineUsersCount } from '@/services/profile';
import { APP_CONFIG } from '@/config/app';
import { PostFeed } from '@/components/feed';
import { LeaderboardCard } from '@/components/leaderboard';
import { CommunityMembersWidget } from '@/components/members/CommunityMembersWidget';
import { AnnouncementBanner } from '@/components/admin';
import { Users } from 'lucide-react';

export default function Explore() {
    const [membersCount, setMembersCount] = useState(0);
    const [onlineCount, setOnlineCount] = useState(0);

    const fetchCounts = useCallback(async () => {
        try {
            const [members, online] = await Promise.all([
                getMembersCount(),
                getOnlineUsersCount(),
            ]);
            setMembersCount(members);
            setOnlineCount(online);
        } catch (error) {
            console.error('Error fetching counts:', error);
        }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    return (
        <>
            {/* Fixed Right Sidebar - hidden on mobile */}
            <div className="hidden lg:block fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin p-4 space-y-6 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800">
                {/* About card */}
                <div className="card p-6 shadow-none">
                    <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">About</h2>
                    <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">
                        Welcome to {APP_CONFIG.name}! {APP_CONFIG.description}
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                            <span className="text-surface-600 dark:text-surface-400">{membersCount} Members</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-surface-600 dark:text-surface-400">{onlineCount} Online</span>
                        </div>
                    </div>
                </div>

                {/* Leaderboard card */}
                <LeaderboardCard period={30} limit={10} title="Top Contributors" />

                {/* Community Members Widget */}
                <CommunityMembersWidget />
            </div>

            {/* Main feed area - leaves space for fixed right sidebar on desktop */}
            <div className="lg:mr-80">
                <AnnouncementBanner />

                <div className="py-8 px-4 sm:px-6 lg:px-8 space-y-6">
                    <div className="card p-6 shadow-none">
                        <h1 className="text-md md:text-lg font-semibold text-surface-900 dark:text-surface-100">
                            Explore
                        </h1>
                        <p className="text-surface-500 dark:text-surface-400 mt-1 text-xs md:text-base">
                            Discover posts from the entire community
                        </p>
                    </div>

                    <PostFeed feedMode="explore" />
                </div>
            </div>
        </>
    );
}
