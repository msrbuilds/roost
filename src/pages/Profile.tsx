import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProfileByUsername, getUserStats } from '@/services/profile';
import { getUserRank } from '@/services/leaderboard';
import { getPosts, type PostWithDetails } from '@/services/post';
import {
    toggleFollow,
    isFollowing as checkIsFollowing,
    getFollowerCount,
    getFollowingCount,
    getFollowers,
    getFollowing,
    getFollowStatusForUsers,
} from '@/services/follow';
import type { Profile } from '@/types/database';
import type { UserRankInfo } from '@/types';
import { PointActivityFeed, UserRankBadge } from '@/components/leaderboard';
import PostCard from '@/components/feed/PostCard';
import {
    MapPin,
    Link as LinkIcon,
    Calendar,
    Settings,
    MessageSquare,
    Loader2,
    FileText,
    UserPlus,
    UserCheck,
    Users,
} from 'lucide-react';
import { ProBadge, RoleBadge } from '@/components/common/ProBadge';

const POSTS_PER_PAGE = 5;
const FOLLOW_LIST_PAGE_SIZE = 20;

type ProfileTab = 'posts' | 'activity' | 'followers' | 'following';

export default function ProfilePage() {
    const { username } = useParams<{ username: string }>();
    const { profile: authProfile } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userRank, setUserRank] = useState<UserRankInfo | null>(null);
    const [userStats, setUserStats] = useState<{ postsCount: number; commentsCount: number }>({ postsCount: 0, commentsCount: 0 });

    // Tab state
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

    // Follow state
    const [isFollowedByMe, setIsFollowedByMe] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    // Posts pagination state
    const [posts, setPosts] = useState<PostWithDetails[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [postsLoadingMore, setPostsLoadingMore] = useState(false);
    const [postsHasMore, setPostsHasMore] = useState(true);
    const [postsOffset, setPostsOffset] = useState(0);
    const postsObserverTarget = useRef<HTMLDivElement>(null);

    // Followers list state
    const [followersList, setFollowersList] = useState<Profile[]>([]);
    const [followersLoading, setFollowersLoading] = useState(false);
    const [followersLoadingMore, setFollowersLoadingMore] = useState(false);
    const [followersHasMore, setFollowersHasMore] = useState(true);
    const [followersOffset, setFollowersOffset] = useState(0);
    const [followersFollowStatus, setFollowersFollowStatus] = useState<Set<string>>(new Set());
    const followersObserverTarget = useRef<HTMLDivElement>(null);

    // Following list state
    const [followingList, setFollowingList] = useState<Profile[]>([]);
    const [followingLoading, setFollowingLoading] = useState(false);
    const [followingLoadingMore, setFollowingLoadingMore] = useState(false);
    const [followingHasMore, setFollowingHasMore] = useState(true);
    const [followingOffset, setFollowingOffset] = useState(0);
    const [followingFollowStatus, setFollowingFollowStatus] = useState<Set<string>>(new Set());
    const followingObserverTarget = useRef<HTMLDivElement>(null);

    // Determine if viewing own profile
    const isOwnProfile = !username || (authProfile && authProfile.username === username);
    const displayProfile = isOwnProfile ? authProfile : profile;

    useEffect(() => {
        const loadProfile = async () => {
            if (isOwnProfile) {
                setIsLoading(false);
                return;
            }

            if (username) {
                try {
                    const data = await getProfileByUsername(username);
                    if (!data) {
                        setError('User not found');
                    } else {
                        setProfile(data);
                    }
                } catch (err) {
                    setError('Failed to load profile');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        loadProfile();
    }, [username, isOwnProfile]);

    // Reset tab when navigating to a different profile
    useEffect(() => {
        setActiveTab('posts');
        setFollowersList([]);
        setFollowingList([]);
        setFollowersOffset(0);
        setFollowingOffset(0);
        setFollowersHasMore(true);
        setFollowingHasMore(true);
    }, [username]);

    // Load user rank and stats
    useEffect(() => {
        const loadRankAndStats = async () => {
            if (!displayProfile) return;
            try {
                const [rank, stats] = await Promise.all([
                    getUserRank(displayProfile.id, undefined, 30),
                    getUserStats(displayProfile.id),
                ]);
                setUserRank(rank);
                setUserStats(stats);
            } catch (err) {
                console.error('Error loading user rank/stats:', err);
            }
        };

        loadRankAndStats();
    }, [displayProfile]);

    // Load follow data
    useEffect(() => {
        const loadFollowData = async () => {
            if (!displayProfile) return;
            try {
                const [followers, following] = await Promise.all([
                    getFollowerCount(displayProfile.id),
                    getFollowingCount(displayProfile.id),
                ]);
                setFollowerCount(followers);
                setFollowingCount(following);

                if (authProfile && !isOwnProfile) {
                    const isFollowed = await checkIsFollowing(authProfile.id, displayProfile.id);
                    setIsFollowedByMe(isFollowed);
                }
            } catch (err) {
                console.error('Error loading follow data:', err);
            }
        };

        loadFollowData();
    }, [displayProfile, authProfile, isOwnProfile]);

    const handleFollowToggle = async () => {
        if (!authProfile || !displayProfile || isFollowLoading) return;
        setIsFollowLoading(true);

        const wasFollowing = isFollowedByMe;
        setIsFollowedByMe(!wasFollowing);
        setFollowerCount(prev => wasFollowing ? prev - 1 : prev + 1);

        try {
            await toggleFollow(authProfile.id, displayProfile.id);
        } catch (err) {
            console.error('Error toggling follow:', err);
            setIsFollowedByMe(wasFollowing);
            setFollowerCount(prev => wasFollowing ? prev + 1 : prev - 1);
        } finally {
            setIsFollowLoading(false);
        }
    };

    // Toggle follow for a user in the followers/following list
    const handleListFollowToggle = async (targetUserId: string, listType: 'followers' | 'following') => {
        if (!authProfile) return;

        const statusSet = listType === 'followers' ? followersFollowStatus : followingFollowStatus;
        const setStatusSet = listType === 'followers' ? setFollowersFollowStatus : setFollowingFollowStatus;
        const wasFollowing = statusSet.has(targetUserId);

        // Optimistic update
        const newSet = new Set(statusSet);
        if (wasFollowing) {
            newSet.delete(targetUserId);
        } else {
            newSet.add(targetUserId);
        }
        setStatusSet(newSet);

        try {
            await toggleFollow(authProfile.id, targetUserId);
        } catch (err) {
            console.error('Error toggling follow:', err);
            // Revert
            const revertSet = new Set(statusSet);
            if (wasFollowing) {
                revertSet.add(targetUserId);
            } else {
                revertSet.delete(targetUserId);
            }
            setStatusSet(revertSet);
        }
    };

    // Load user posts
    const loadPosts = useCallback(async (reset = false) => {
        if (!displayProfile) return;

        const currentOffset = reset ? 0 : postsOffset;

        try {
            if (reset) {
                setPostsLoading(true);
                setPostsOffset(0);
                setPosts([]);
            }

            const { posts: newPosts, hasMore } = await getPosts(undefined, {
                authorId: displayProfile.id,
                limit: POSTS_PER_PAGE,
                offset: currentOffset,
                pinnedFirst: false,
            });

            if (reset) {
                setPosts(newPosts);
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            setPostsHasMore(hasMore);
        } catch (err) {
            console.error('Error loading user posts:', err);
        } finally {
            setPostsLoading(false);
            setPostsLoadingMore(false);
        }
    }, [displayProfile, postsOffset]);

    // Initial posts load
    useEffect(() => {
        if (displayProfile) {
            loadPosts(true);
        }
    }, [displayProfile]);

    // Posts infinite scroll observer
    useEffect(() => {
        if (activeTab !== 'posts') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && postsHasMore && !postsLoadingMore && !postsLoading) {
                    loadMorePosts();
                }
            },
            { threshold: 0.1 }
        );

        if (postsObserverTarget.current) {
            observer.observe(postsObserverTarget.current);
        }

        return () => observer.disconnect();
    }, [postsHasMore, postsLoadingMore, postsLoading, activeTab]);

    const loadMorePosts = async () => {
        if (!postsHasMore || postsLoadingMore || !displayProfile) return;

        setPostsLoadingMore(true);
        const newOffset = postsOffset + POSTS_PER_PAGE;
        setPostsOffset(newOffset);

        try {
            const { posts: newPosts, hasMore } = await getPosts(undefined, {
                authorId: displayProfile.id,
                limit: POSTS_PER_PAGE,
                offset: newOffset,
                pinnedFirst: false,
            });

            setPosts(prev => [...prev, ...newPosts]);
            setPostsHasMore(hasMore);
        } catch (err) {
            console.error('Error loading more posts:', err);
        } finally {
            setPostsLoadingMore(false);
        }
    };

    const handlePostDeleted = (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setUserStats(prev => ({ ...prev, postsCount: prev.postsCount - 1 }));
    };

    // Load followers list
    const loadFollowersList = useCallback(async (reset = false) => {
        if (!displayProfile) return;

        const currentOffset = reset ? 0 : followersOffset;

        try {
            if (reset) {
                setFollowersLoading(true);
                setFollowersOffset(0);
                setFollowersList([]);
            }

            const { profiles, hasMore } = await getFollowers(displayProfile.id, FOLLOW_LIST_PAGE_SIZE, currentOffset);

            if (reset) {
                setFollowersList(profiles);
            } else {
                setFollowersList(prev => [...prev, ...profiles]);
            }
            setFollowersHasMore(hasMore);

            // Get follow status for these users
            if (authProfile && profiles.length > 0) {
                const ids = profiles.map(p => p.id);
                const status = await getFollowStatusForUsers(authProfile.id, ids);
                setFollowersFollowStatus(prev => {
                    const merged = new Set(prev);
                    status.forEach(id => merged.add(id));
                    return merged;
                });
            }
        } catch (err) {
            console.error('Error loading followers:', err);
        } finally {
            setFollowersLoading(false);
            setFollowersLoadingMore(false);
        }
    }, [displayProfile, followersOffset, authProfile]);

    // Load following list
    const loadFollowingList = useCallback(async (reset = false) => {
        if (!displayProfile) return;

        const currentOffset = reset ? 0 : followingOffset;

        try {
            if (reset) {
                setFollowingLoading(true);
                setFollowingOffset(0);
                setFollowingList([]);
            }

            const { profiles, hasMore } = await getFollowing(displayProfile.id, FOLLOW_LIST_PAGE_SIZE, currentOffset);

            if (reset) {
                setFollowingList(profiles);
            } else {
                setFollowingList(prev => [...prev, ...profiles]);
            }
            setFollowingHasMore(hasMore);

            // Get follow status for these users
            if (authProfile && profiles.length > 0) {
                const ids = profiles.map(p => p.id);
                const status = await getFollowStatusForUsers(authProfile.id, ids);
                setFollowingFollowStatus(prev => {
                    const merged = new Set(prev);
                    status.forEach(id => merged.add(id));
                    return merged;
                });
            }
        } catch (err) {
            console.error('Error loading following:', err);
        } finally {
            setFollowingLoading(false);
            setFollowingLoadingMore(false);
        }
    }, [displayProfile, followingOffset, authProfile]);

    // Load followers/following when tab changes
    useEffect(() => {
        if (activeTab === 'followers' && followersList.length === 0 && displayProfile) {
            loadFollowersList(true);
        }
        if (activeTab === 'following' && followingList.length === 0 && displayProfile) {
            loadFollowingList(true);
        }
    }, [activeTab, displayProfile]);

    // Followers infinite scroll
    useEffect(() => {
        if (activeTab !== 'followers') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && followersHasMore && !followersLoadingMore && !followersLoading) {
                    setFollowersLoadingMore(true);
                    const newOffset = followersOffset + FOLLOW_LIST_PAGE_SIZE;
                    setFollowersOffset(newOffset);
                    loadFollowersList(false);
                }
            },
            { threshold: 0.1 }
        );

        if (followersObserverTarget.current) {
            observer.observe(followersObserverTarget.current);
        }

        return () => observer.disconnect();
    }, [followersHasMore, followersLoadingMore, followersLoading, activeTab]);

    // Following infinite scroll
    useEffect(() => {
        if (activeTab !== 'following') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && followingHasMore && !followingLoadingMore && !followingLoading) {
                    setFollowingLoadingMore(true);
                    const newOffset = followingOffset + FOLLOW_LIST_PAGE_SIZE;
                    setFollowingOffset(newOffset);
                    loadFollowingList(false);
                }
            },
            { threshold: 0.1 }
        );

        if (followingObserverTarget.current) {
            observer.observe(followingObserverTarget.current);
        }

        return () => observer.disconnect();
    }, [followingHasMore, followingLoadingMore, followingLoading, activeTab]);

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    // Error state
    if (error || !displayProfile) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                    {error || 'User not found'}
                </h1>
                <p className="text-surface-500 dark:text-surface-400 mb-6">
                    The profile you're looking for doesn't exist or has been removed.
                </p>
                <Link to="/" className="btn-primary">
                    Go Home
                </Link>
            </div>
        );
    }

    // Format join date
    const joinDate = new Date(displayProfile.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const isPremium = displayProfile.membership_type === 'premium';

    const TABS: { id: ProfileTab; label: string; count?: number }[] = [
        { id: 'posts', label: 'Posts', count: userStats.postsCount },
        { id: 'activity', label: 'Point Activity' },
        { id: 'followers', label: 'Followers', count: followerCount },
        { id: 'following', label: 'Following', count: followingCount },
    ];

    const renderUserRow = (user: Profile, followStatus: Set<string>, listType: 'followers' | 'following') => {
        const isSelf = authProfile?.id === user.id;
        const isFollowed = followStatus.has(user.id);

        return (
            <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <Link to={`/profile/${user.username}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-bold text-sm flex items-center justify-center">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                        ) : (
                            <span>{user.display_name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                </Link>
                <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.username}`} className="block">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                            {user.display_name}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                            @{user.username}
                        </p>
                    </Link>
                </div>
                {authProfile && !isSelf && (
                    <button
                        onClick={() => handleListFollowToggle(user.id, listType)}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            isFollowed
                                ? 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                    >
                        {isFollowed ? 'Following' : 'Follow'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Profile Header Card */}
            <div className="card overflow-hidden">
                {/* Cover Photo */}
                <div className="relative h-48 md:h-[400px] bg-gradient-to-br from-primary-400 to-primary-600">
                    {displayProfile.cover_url && (
                        <img
                            src={displayProfile.cover_url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    {/* Avatar + Info */}
                    <div className="flex flex-col sm:flex-row gap-4 mt-2 relative z-10 items-center">
                        {/* Avatar */}
                        <div className="flex-shrink-0 mx-auto sm:mx-0">
                            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-bold text-4xl flex items-center justify-center border-4 border-white dark:border-surface-900">
                                {displayProfile.avatar_url ? (
                                    <img
                                        src={displayProfile.avatar_url}
                                        alt={displayProfile.display_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span>{displayProfile.display_name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 text-center sm:text-left pt-0 sm:pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div>
                                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                                            {displayProfile.display_name}
                                        </h1>
                                        {(displayProfile.role === 'admin' || displayProfile.role === 'superadmin' || displayProfile.role === 'moderator')
                                            ? <RoleBadge role={displayProfile.role} size="sm" />
                                            : isPremium && <ProBadge size="sm" />
                                        }
                                    </div>
                                    <p className="text-surface-500 dark:text-surface-400">@{displayProfile.username}</p>
                                </div>

                                {/* Actions */}
                                {isOwnProfile ? (
                                    <Link to="/settings" className="btn-secondary">
                                        <Settings className="w-4 h-4" />
                                        <span>Edit Profile</span>
                                    </Link>
                                ) : (
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                        <button
                                            onClick={handleFollowToggle}
                                            disabled={isFollowLoading}
                                            className={isFollowedByMe ? 'btn-secondary' : 'btn-primary'}
                                        >
                                            {isFollowedByMe ? (
                                                <UserCheck className="w-4 h-4" />
                                            ) : (
                                                <UserPlus className="w-4 h-4" />
                                            )}
                                            <span>{isFollowedByMe ? 'Following' : 'Follow'}</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/messages/${displayProfile.id}`)}
                                            className="btn-secondary"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            <span>Message</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Bio */}
                            {displayProfile.bio && (
                                <p className="mt-3 text-surface-600 dark:text-surface-400">{displayProfile.bio}</p>
                            )}

                            {/* Meta info */}
                            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-surface-500 dark:text-surface-400">
                                {displayProfile.location && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        <span>{displayProfile.location}</span>
                                    </div>
                                )}
                                {displayProfile.website && (
                                    <a
                                        href={displayProfile.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                        <span>Website</span>
                                    </a>
                                )}
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Joined {joinDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center items-center">
                            <button onClick={() => setActiveTab('followers')} className="group">
                                <div className="text-2xl font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {followerCount}
                                </div>
                                <div className="text-sm text-surface-500 dark:text-surface-400">Followers</div>
                            </button>
                            <button onClick={() => setActiveTab('following')} className="group">
                                <div className="text-2xl font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {followingCount}
                                </div>
                                <div className="text-sm text-surface-500 dark:text-surface-400">Following</div>
                            </button>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                                    {userStats.postsCount}
                                </div>
                                <div className="text-sm text-surface-500 dark:text-surface-400">Posts</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                                    {userStats.commentsCount}
                                </div>
                                <div className="text-sm text-surface-500 dark:text-surface-400">Comments</div>
                            </div>
                            <div>
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {userRank && <UserRankBadge rank={userRank.rank} size="sm" />}
                                </div>
                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {userRank ? userRank.points.toLocaleString() : '0'}
                                </div>
                                <div className="text-sm text-surface-500 dark:text-surface-400">Points</div>
                                {userRank && (
                                    <div className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                                        Rank #{userRank.rank}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="mt-6 border-b border-surface-200 dark:border-surface-700">
                <div className="flex gap-0 -mb-px overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                                    : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600'
                            }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-1.5 text-xs text-surface-400 dark:text-surface-500">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {/* Posts Tab */}
                {activeTab === 'posts' && (
                    <div>
                        {postsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="card p-8 text-center">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                                <p className="text-surface-500 dark:text-surface-400">
                                    {isOwnProfile ? "You haven't created any posts yet." : "This user hasn't created any posts yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        onDelete={handlePostDeleted}
                                    />
                                ))}

                                {postsHasMore && (
                                    <div ref={postsObserverTarget} className="py-4 text-center">
                                        {postsLoadingMore ? (
                                            <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="text-sm">Loading more posts...</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-surface-400 dark:text-surface-500">
                                                Scroll for more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Point Activity Tab */}
                {activeTab === 'activity' && (
                    <div className="card p-6">
                        <PointActivityFeed userId={displayProfile.id} />
                    </div>
                )}

                {/* Followers Tab */}
                {activeTab === 'followers' && (
                    <div>
                        {followersLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                            </div>
                        ) : followersList.length === 0 ? (
                            <div className="card p-8 text-center">
                                <Users className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                                <p className="text-surface-500 dark:text-surface-400">
                                    {isOwnProfile ? "You don't have any followers yet." : "This user doesn't have any followers yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="card divide-y divide-surface-100 dark:divide-surface-800">
                                {followersList.map((user) => renderUserRow(user, followersFollowStatus, 'followers'))}

                                {followersHasMore && (
                                    <div ref={followersObserverTarget} className="py-4 text-center">
                                        {followersLoadingMore ? (
                                            <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="text-sm">Loading more...</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-surface-400 dark:text-surface-500">
                                                Scroll for more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Following Tab */}
                {activeTab === 'following' && (
                    <div>
                        {followingLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                            </div>
                        ) : followingList.length === 0 ? (
                            <div className="card p-8 text-center">
                                <Users className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                                <p className="text-surface-500 dark:text-surface-400">
                                    {isOwnProfile ? "You aren't following anyone yet." : "This user isn't following anyone yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="card divide-y divide-surface-100 dark:divide-surface-800">
                                {followingList.map((user) => renderUserRow(user, followingFollowStatus, 'following'))}

                                {followingHasMore && (
                                    <div ref={followingObserverTarget} className="py-4 text-center">
                                        {followingLoadingMore ? (
                                            <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="text-sm">Loading more...</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-surface-400 dark:text-surface-500">
                                                Scroll for more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
