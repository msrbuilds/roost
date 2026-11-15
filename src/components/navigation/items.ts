import { Home, Users, BookOpen, Calendar, Trophy, HelpCircle, MessageSquare, Rocket, Key, Lightbulb, Compass, Radio, type LucideIcon } from 'lucide-react';
import { APP_CONFIG } from '@/config/app';
import type { FeatureAccess } from '@/contexts/SiteSettingsContext';

type FeatureKey = 'live_room' | 'activations' | 'roadmap' | 'showcase';
interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    premiumOnly?: boolean;
    featureKey?: FeatureKey;
}

const items: NavItem[] = [
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

// Both menus use the same feature and membership rules, without changing the source items.
export function getNavigationItems(getFeatureAccess: (feature: FeatureKey) => FeatureAccess): NavItem[] {
    return items.flatMap(item => {
        if (item.href === '/leaderboard' && !APP_CONFIG.features.leaderboard) return [];
        if (!item.featureKey) return [{ ...item }];
        const access = getFeatureAccess(item.featureKey);
        return access === 'disabled' ? [] : [{ ...item, premiumOnly: access === 'premium_only' }];
    });
}
