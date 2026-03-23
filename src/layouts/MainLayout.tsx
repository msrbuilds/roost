import { Outlet } from 'react-router-dom';
import TopNav from '@/components/navigation/TopNav';
import SideNav from '@/components/navigation/SideNav';
import { usePresence } from '@/hooks';
import { SidebarProvider, useSidebar } from '@/contexts';

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
