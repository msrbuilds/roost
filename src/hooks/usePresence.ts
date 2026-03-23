import { useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to track user's online presence
 * Updates the user's online status in the database and tracks activity
 */
export function usePresence() {
    const { user } = useAuth();

    // Update online status in database
    const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
        if (!user) return;

        try {
            await supabase
                .from('profiles')
                .update({
                    is_online: isOnline,
                    last_seen_at: new Date().toISOString(),
                } as never)
                .eq('id', user.id);
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        // Set online when hook mounts
        updateOnlineStatus(true);

        // Track visibility changes (tab focus)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateOnlineStatus(true);
            } else {
                updateOnlineStatus(false);
            }
        };

        // Track before unload (closing tab/browser)
        const handleBeforeUnload = () => {
            // Note: This is best-effort since page is being unloaded
            // The heartbeat timeout will eventually mark user offline
            updateOnlineStatus(false);
        };

        // Heartbeat to keep online status fresh (every 60 seconds)
        const heartbeatInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateOnlineStatus(true);
            }
        }, 60000);

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(heartbeatInterval);
            updateOnlineStatus(false);
        };
    }, [user, updateOnlineStatus]);
}

/**
 * Hook to subscribe to online users count
 */
export function useOnlineUsersCount(onUpdate: (count: number) => void) {
    useEffect(() => {
        // Initial fetch
        const fetchCount = async () => {
            const threshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            const { count } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('last_seen_at', threshold);

            onUpdate(count || 0);
        };

        fetchCount();

        // Subscribe to changes (poll every 30 seconds since realtime for count is complex)
        const interval = setInterval(fetchCount, 30000);

        return () => clearInterval(interval);
    }, [onUpdate]);
}

/**
 * Hook to subscribe to a specific user's online status
 */
export function useUserOnlineStatus(userId: string | undefined) {
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`presence:${userId}`)
            .on(
                'postgres_changes' as const,
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                } as const,
                (_payload: { new: { is_online: boolean } }) => {
                    // This will trigger re-renders via the profile state in AuthContext
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);
}
