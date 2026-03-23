import { useState, useEffect, useCallback, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import {
    Search,
    Bell,
    MessageSquare,
    Home,
    Users,
    BookOpen,
    Calendar,
    Trophy,
    HelpCircle,
    Menu,
    X,
    LogOut,
    Settings,
    User,
    ChevronDown,
    Shield,
    Moon,
    Sun,
    Rocket,
    Compass,
    Crown,
    LucideIcon,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { APP_CONFIG } from '@/config/app';
import { getUnreadMessageCount } from '@/services/message';
import { getUnreadNotificationCount } from '@/services/notification';
import { useLiveStatus } from '@/hooks';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import NotificationBadge from '@/components/notifications/NotificationBadge';
import GlobalSearch from '@/components/search/GlobalSearch';
import { ProBadge } from '@/components/common/ProBadge';

// Navigation item type
interface NavTab {
    name: string;
    href: string;
    icon: LucideIcon;
    premiumOnly?: boolean;
}

// Mobile navigation tabs (matches SideNav items)
const navTabs: NavTab[] = [
    { name: 'Community', href: '/', icon: Home },
    { name: 'Explore', href: '/explore', icon: Compass },
    { name: 'Classrooms', href: '/classrooms', icon: BookOpen },
    { name: 'Showcase', href: '/showcase', icon: Rocket },
    { name: 'Calendar', href: '/calendar', icon: Calendar, premiumOnly: true },
    { name: 'Members', href: '/members', icon: Users },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Messages', href: '/messages', icon: MessageSquare, premiumOnly: true },
    { name: 'Guide', href: '/guide', icon: HelpCircle },
];

function TopNav() {
    const { user, profile, signOut, isPremium } = useAuth();
    const { isCollapsed } = useSidebar();
    const { resolvedTheme, setTheme } = useTheme();
    const { settings: siteSettings } = useSiteSettings();
    const location = useLocation();
    const { isLive } = useLiveStatus();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Fetch unread counts
    const fetchUnreadCounts = useCallback(async () => {
        if (!user) return;

        try {
            const [messageCount, notificationCount] = await Promise.all([
                getUnreadMessageCount(user.id),
                getUnreadNotificationCount(user.id)
            ]);

            setUnreadMessages(messageCount);
            setUnreadNotifications(notificationCount);
        } catch (error) {
            console.error('Error fetching unread counts:', error);
        }
    }, [user]);

    // Initial fetch and real-time subscription
    useEffect(() => {
        if (!user) return;

        // Fetch initial counts
        fetchUnreadCounts();

        // Subscribe to real-time updates
        const channel = supabase
            .channel(`unread-counts-${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `recipient_id=eq.${user.id}`
            }, fetchUnreadCounts)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, fetchUnreadCounts)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchUnreadCounts]);

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:left-16' : 'lg:left-64'}`}>
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo - Mobile only */}
                    <div className="flex-shrink-0 lg:hidden">
                        <Link to="/" className="flex items-center gap-2">
                            {/* Light mode logo */}
                            <img
                                src={siteSettings.logo_url || '/logo-square-sm.png'}
                                alt={siteSettings.site_name || APP_CONFIG.name}
                                className="w-8 h-8 rounded-lg flex-shrink-0 object-cover dark:hidden"
                            />
                            {/* Dark mode logo */}
                            <img
                                src={siteSettings.logo_dark_url || siteSettings.logo_url || '/logo-square-sm-dark.png'}
                                alt={siteSettings.site_name || APP_CONFIG.name}
                                className="w-8 h-8 rounded-xl flex-shrink-0 object-cover hidden dark:block"
                            />
                        </Link>
                    </div>

                    {/* Search bar - Desktop (takes more space now) */}
                    <div className="hidden md:flex flex-1 max-w-full lg:max-w-4xl">
                        <GlobalSearch className="w-full" placeholder="Search members, posts, classrooms..." />
                    </div>

                    {/* Right section */}
                    <div className="flex items-center gap-1">
                        {/* Search button - Mobile */}
                        <button
                            onClick={() => setIsSearchOpen(!isSearchOpen)}
                            className="md:hidden p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                        >
                            <Search className="w-5 h-5" />
                        </button>

                        {/* Messages */}
                        <Link
                            to={isPremium ? "/messages" : "/upgrade"}
                            className={`p-2 rounded-lg relative ${isPremium
                                ? 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                                : 'text-surface-400 dark:text-surface-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}
                            title={isPremium ? "Messages" : "Messages (Premium)"}
                        >
                            <MessageSquare className="w-5 h-5" />
                            {isPremium ? (
                                <NotificationBadge count={unreadMessages} />
                            ) : (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Crown className="w-2.5 h-2.5 text-white" />
                                </span>
                            )}
                        </Link>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
                                className="p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 relative"
                            >
                                <Bell className="w-5 h-5" />
                                <NotificationBadge count={unreadNotifications} />
                            </button>

                            {/* Notification Center dropdown */}
                            <NotificationCenter
                                isOpen={isNotificationCenterOpen}
                                onClose={() => setIsNotificationCenterOpen(false)}
                                onNavigate={() => setIsNotificationCenterOpen(false)}
                                onUnreadCountChange={setUnreadNotifications}
                            />
                        </div>

                        {/* Live Now indicator */}
                        {isLive && (
                            <Link
                                to="/live"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors animate-pulse"
                                title="A live session is happening now!"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                LIVE
                            </Link>
                        )}

                        {/* Dark mode toggle */}
                        <button
                            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {resolvedTheme === 'dark' ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>

                        {/* Profile dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                            >
                                <div className="avatar-sm bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-medium">
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile.display_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>{profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}</span>
                                    )}
                                </div>
                                <ChevronDown className="w-4 h-4 text-surface-400 hidden sm:block" />
                            </button>

                            {/* Profile dropdown menu */}
                            {isProfileMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                    />
                                    <div className="dropdown-menu right-0 top-full mt-2 w-[250px] z-50">
                                        <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-700">
                                            {isPremium && <ProBadge size="xs" />}
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-surface-900 dark:text-surface-50">
                                                    {profile?.display_name || 'User'}
                                                </p>
                                            </div>
                                            <p className="text-xs text-surface-500 dark:text-surface-400">
                                                @{profile?.username || 'username'}
                                            </p>
                                        </div>
                                        <div className="py-1">
                                            <Link
                                                to="/profile"
                                                className="dropdown-item"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <User className="w-4 h-4" />
                                                <span>Profile</span>
                                            </Link>
                                            <Link
                                                to="/settings"
                                                className="dropdown-item"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <Settings className="w-4 h-4" />
                                                <span>Settings</span>
                                            </Link>
                                            <Link
                                                to="/guide"
                                                className="dropdown-item"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <HelpCircle className="w-4 h-4" />
                                                <span>Guide</span>
                                            </Link>
                                            {profile?.role && ['admin', 'superadmin', 'moderator'].includes(profile.role) && (
                                                <Link
                                                    to="/admin"
                                                    className="dropdown-item text-purple-600 dark:text-purple-400"
                                                    onClick={() => setIsProfileMenuOpen(false)}
                                                >
                                                    <Shield className="w-4 h-4" />
                                                    <span>Admin Panel</span>
                                                </Link>
                                            )}
                                        </div>
                                        <div className="border-t border-surface-100 dark:border-surface-700 py-1">
                                            <button
                                                onClick={handleSignOut}
                                                className="dropdown-item text-error w-full"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span>Sign out</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-5 h-5" />
                            ) : (
                                <Menu className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile search bar */}
                {isSearchOpen && (
                    <div className="md:hidden py-3 border-t border-surface-100 dark:border-surface-700">
                        <GlobalSearch
                            className="w-full"
                            placeholder="Search members, posts, classrooms..."
                            autoFocus
                            onClose={() => setIsSearchOpen(false)}
                        />
                    </div>
                )}

                {/* Mobile navigation menu */}
                {isMobileMenuOpen && (
                    <nav className="lg:hidden py-3 border-t border-surface-100 dark:border-surface-700">
                        <div className="flex flex-col gap-1">
                            {navTabs.map((tab) => {
                                const isActive = location.pathname === tab.href;
                                const isLocked = tab.premiumOnly && !isPremium;

                                // Show locked state for premium-only items
                                if (isLocked) {
                                    return (
                                        <Link
                                            key={tab.name}
                                            to="/upgrade"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-surface-400 dark:text-surface-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400"
                                        >
                                            <tab.icon className="w-5 h-5" />
                                            <span className="flex-1">{tab.name}</span>
                                            <Crown className="w-4 h-4 text-amber-500" />
                                        </Link>
                                    );
                                }

                                return (
                                    <Link
                                        key={tab.name}
                                        to={tab.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                                                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
                                            }
                    `}
                                    >
                                        <tab.icon className="w-5 h-5" />
                                        <span>{tab.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
}

export default memo(TopNav);
