import { Outlet } from 'react-router-dom';
import TopNav from '@/components/navigation/TopNav';
import SideNav from '@/components/navigation/SideNav';
import { usePresence } from '@/hooks';
import { SidebarProvider, useSidebar } from '@/contexts';
import { APP_CONFIG } from '@/config/app';

function MainLayoutContent() {
    const { isCollapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
            {/* Side Navigation - Desktop only */}
            <SideNav />

            {/* Top Navigation - Mobile header + Desktop utility bar */}
            <TopNav />

            {/* Main content area - shifted right on desktop for sidebar */}
            <main
                className={`
                    pt-16 transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'lg:pl-16' : 'lg:pl-64'}
                `}
            >
                {APP_CONFIG.demo.enabled && <div role="note" className="border-b border-primary-200 bg-primary-50 px-4 py-3 text-center text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">Read-only demo · Sample content · <a href="https://roost.msrbuilds.com/docs/self-hosted-setup/" className="font-semibold underline underline-offset-2">Create your own community</a></div>}
                <Outlet />
            </main>
        </div>
    );
}

export default function MainLayout() {
    // Track user's online presence
    usePresence();

    return (
        <SidebarProvider>
            <MainLayoutContent />
        </SidebarProvider>
    );
}
