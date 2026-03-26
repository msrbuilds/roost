import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { APP_CONFIG } from '@/config/app';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import {
    Home,
    Users,
    BookOpen,
    Calendar,
    Trophy,
    HelpCircle,
    MessageSquare,
    Settings,
    Shield,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Rocket,
    Key,
    Crown,
    Lightbulb,
    Compass,
    Radio,
    LucideIcon,
} from 'lucide-react';

// Navigation item type
interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    premiumOnly?: boolean;
    featureKey?: 'live_room' | 'activations' | 'roadmap' | 'showcase';
}

// Main navigation items (featureKey items are filtered by admin settings)
const allNavItems: NavItem[] = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Explore', href: '/explore', icon: Compass },
    { name: 'Classrooms', href: '/classrooms', icon: BookOpen },
    { name: 'Showcase', href: '/showcase', icon: Rocket, featureKey: 'showcase' },
    { name: 'Calendar', href: '/calendar', icon: Calendar, premiumOnly: true },
    { name: 'Members', href: '/members', icon: Users },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Messages', href: '/messages', icon: MessageSquare, premiumOnly: true },
    { name: 'Live Room', href: '/live', icon: Radio, premiumOnly: true, featureKey: 'live_room' },
    { name: 'Activations', href: '/activations', icon: Key, premiumOnly: true, featureKey: 'activations' },
    { name: 'Roadmap & Issues', href: '/roadmap', icon: Lightbulb, featureKey: 'roadmap' },
    { name: 'Guide', href: '/guide', icon: HelpCircle },
];

export default function SideNav() {
    const { user, profile, signOut, isPremium } = useAuth();
    const location = useLocation();
    const { isCollapsed, toggleSidebar } = useSidebar();
    const { settings: siteSettings, getFeatureAccess } = useSiteSettings();

    // Filter nav items based on feature module settings
    const navItems = allNavItems.filter(item => {
        if (!item.featureKey) return true;
        const access = getFeatureAccess(item.featureKey);
        if (access === 'disabled') return false;
        // Override premiumOnly based on admin setting
        if (access === 'all') item.premiumOnly = false;
        else if (access === 'premium_only') item.premiumOnly = true;
        return true;
    });

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <aside
            className={`
                hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 z-40
                transition-all duration-300 ease-in-out
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Logo */}
            <div className={`flex items-center h-16 border-b border-surface-200 dark:border-surface-700 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
                <Link to="/" className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
                    {/* Light mode logo */}
                    <img
                        src={siteSettings.logo_url || '/logo-square-sm.png'}
                        alt={siteSettings.site_name || APP_CONFIG.name}
                        className="w-10 h-10 rounded-lg flex-shrink-0 object-cover dark:hidden"
                    />
                    {/* Dark mode logo */}
                    <img
                        src={siteSettings.logo_dark_url || siteSettings.logo_url || '/logo-square-sm-dark.png'}
                        alt={siteSettings.site_name || APP_CONFIG.name}
                        className="w-10 h-10 rounded-xl flex-shrink-0 object-cover hidden dark:block"
                    />
                    {!isCollapsed && (
                        <span className="font-bold text-xl text-surface-900 dark:text-surface-50 whitespace-nowrap">
                            {siteSettings.site_name || APP_CONFIG.name}
                        </span>
                    )}
                </Link>
                {!isCollapsed && (
                    <button
                        onClick={toggleSidebar}
                        className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        title="Collapse sidebar"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Expand button when collapsed */}
            {isCollapsed && (
                <div className="px-2 py-3 border-b border-surface-100 dark:border-surface-800">
                    <button
                        onClick={toggleSidebar}
                        className="w-full p-2 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-300 transition-colors flex items-center justify-center"
                        title="Expand sidebar"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className={`flex-1 py-4 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'}`}>
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href ||
                            (item.href !== '/' && location.pathname.startsWith(item.href));
                        const isLocked = item.premiumOnly && !isPremium;

                        // Show locked state for premium-only items when user is not premium
                        if (isLocked) {
                            return (
                                <Link
                                    key={item.name}
                                    to="/upgrade"
                                    title={isCollapsed ? `${item.name} (Premium)` : undefined}
                                    className={`
                                        flex items-center rounded-lg text-sm font-medium transition-all
                                        ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
                                        text-surface-400 dark:text-surface-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400
                                    `}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {!isCollapsed && (
                                        <>
                                            <span className="flex-1">{item.name}</span>
                                            <Crown className="w-4 h-4 text-amber-500" />
                                        </>
                                    )}
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                title={isCollapsed ? item.name : undefined}
                                className={`
                                    flex items-center rounded-lg text-sm font-medium transition-all
                                    ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
                                    ${isActive
                                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
                                    }
                                `}
                            >
                                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                                {!isCollapsed && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* Admin section */}
                {profile?.role && ['admin', 'superadmin', 'moderator'].includes(profile.role) && (
                    <div className={`mt-6 pt-6 border-t border-surface-100 dark:border-surface-800 ${isCollapsed ? '' : ''}`}>
                        {!isCollapsed && (
                            <p className="px-3 mb-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                Admin
                            </p>
                        )}
                        <Link
                            to="/admin"
                            title={isCollapsed ? 'Admin Panel' : undefined}
                            className={`
                                flex items-center rounded-lg text-sm font-medium transition-all
                                ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
                                ${location.pathname.startsWith('/admin')
                                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                    : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                }
                            `}
                        >
                            <Shield className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && <span>Admin Panel</span>}
                        </Link>
                    </div>
                )}
            </nav>

            {/* User profile section */}
            <div className={`border-t border-surface-200 dark:border-surface-700 ${isCollapsed ? 'p-2' : 'p-3'}`}>
                {isCollapsed ? (
                    // Collapsed: just avatar with tooltip
                    <div className="flex flex-col items-center gap-2">
                        <Link
                            to="/profile"
                            title={profile?.display_name || 'Profile'}
                            className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-700 transition-all"
                        >
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.display_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-primary-600 dark:text-primary-400 font-medium">
                                    {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                                </span>
                            )}
                        </Link>
                        <Link
                            to="/settings"
                            title="Settings"
                            className="p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                        </Link>
                        <button
                            onClick={handleSignOut}
                            title="Sign out"
                            className="p-2 rounded-lg text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    // Expanded: full profile section
                    <>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                            <Link to="/profile" className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile.display_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-primary-600 dark:text-primary-400 font-medium">
                                            {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">
                                        {profile?.display_name || 'User'}
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                        @{profile?.username || 'username'}
                                    </p>
                                </div>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}
