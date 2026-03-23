import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env.local file.'
    );
}

// Create Supabase client with publishable key (safe for browser with RLS enabled)
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// Helper to get the current user
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}

// Helper to get the current session
export async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
}

// Auth methods
export const auth = {
    // Sign up with email and password
    async signUp(email: string, password: string, metadata?: { username?: string; display_name?: string }) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
            },
        });
        if (error) throw error;
        return data;
    },

    // Sign in with email and password
    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    // Sign out
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Supabase signOut error:', error);
            // Don't throw - we still want to clear local state
        }
    },

    // Reset password
    async resetPassword(email: string) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        return data;
    },

    // Update password
    async updatePassword(newPassword: string) {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
        });
        if (error) throw error;
        return data;
    },

    // Subscribe to auth state changes
    onAuthStateChange(callback: (event: string, session: unknown) => void) {
        return supabase.auth.onAuthStateChange(callback);
    },
};

// Export type-safe table helpers
export const db = {
    profiles: () => supabase.from('profiles'),
    groups: () => supabase.from('groups'),
    groupMembers: () => supabase.from('group_members'),
    posts: () => supabase.from('posts'),
    comments: () => supabase.from('comments'),
    reactions: () => supabase.from('reactions'),
    messages: () => supabase.from('messages'),
    notifications: () => supabase.from('notifications'),
    assets: () => supabase.from('assets'),
    events: () => supabase.from('events'),
    eventAttendees: () => supabase.from('event_attendees'),
    leaderboardEntries: () => supabase.from('leaderboard_entries'),
    categories: () => supabase.from('categories'),
    featureRequests: () => supabase.from('feature_requests'),
    featureRequestComments: () => supabase.from('feature_request_comments'),
};

// Realtime subscriptions helper
export const realtime = {
    // Subscribe to a channel
    channel(name: string) {
        return supabase.channel(name);
    },

    // Subscribe to table changes - use the channel directly for full control
    // Example usage:
    // realtime.channel('posts').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, callback).subscribe()
};

export default supabase;
