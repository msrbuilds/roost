import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';

type Feature = 'live_room' | 'activations' | 'roadmap' | 'showcase';

export default function FeatureRoute({ feature, children }: { feature: Feature; children: ReactNode }) {
    const { isPremium } = useAuth();
    const { isFeatureEnabled, isLoading } = useSiteSettings();
    if (isLoading) return <div className="p-8 text-center">Loading…</div>;
    if (!isFeatureEnabled(feature, isPremium)) return <Navigate to={isPremium ? "/" : "/upgrade"} replace />;
    return children;
}
