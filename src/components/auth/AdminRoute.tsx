import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * Protects admin routes - allows access to platform admins, superadmins, and moderators
 */
export default function AdminRoute({ children }: AdminRouteProps) {
    const { user, isLoading: authLoading, isPlatformModerator } = useAuth();
    const location = useLocation();

    // Show loading while checking auth
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
            </div>
        );
    }

    // Not logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Not a moderator or admin - redirect to home
    if (!isPlatformModerator) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
