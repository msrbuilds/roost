import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    redirectTo?: string;
    requirePremium?: boolean;
}

export default function ProtectedRoute({
    redirectTo = '/login',
    requirePremium = false,
}: ProtectedRouteProps) {
    const { isAuthenticated, isLoading: authLoading, isBanned, isPremium, isPremiumLoading, isEmailConfirmed } = useAuth();

    // Determine if we need to wait for loading
    const isLoading = authLoading || (requirePremium && isPremiumLoading);

    // Show loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    <p className="text-sm text-surface-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to={redirectTo} replace />;
    }

    // Redirect to email confirmation page if email not confirmed
    if (!isEmailConfirmed) {
        return <Navigate to="/confirm-email" replace />;
    }

    // Redirect to banned page if user is banned
    if (isBanned) {
        return <Navigate to="/banned" replace />;
    }

    // Check for premium requirement
    if (requirePremium && !isPremium) {
        return <Navigate to="/upgrade" replace />;
    }

    // Render child routes
    return <Outlet />;
}
