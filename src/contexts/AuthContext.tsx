import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, auth } from '@/services/supabase';
import type { Profile, MembershipType } from '@/types/database';

// Ban info type
interface BanInfo {
    isBanned: boolean;
    reason: string | null;
    expiresAt: Date | null;
    isPermanent: boolean;
}

// Signup result type
interface SignUpResult {
    requiresEmailConfirmation: boolean;
    email: string;
}

// Auth context types
interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    // Email confirmation status
    isEmailConfirmed: boolean;
    // Ban status
    isBanned: boolean;
    banInfo: BanInfo | null;
    // Platform role helpers
    isPlatformAdmin: boolean;
    isPlatformModerator: boolean;
    isSuperAdmin: boolean;
    // Membership status
    membershipType: MembershipType | null;
    isPremium: boolean;
    isPremiumLoading: boolean;
    // Auth methods
    signUp: (email: string, password: string, metadata?: { username?: string; display_name?: string }) => Promise<SignUpResult>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateProfile: (updates: Partial<Profile>) => Promise<void>;
    refreshProfile: () => Promise<void>;
    refreshPremiumStatus: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
    children: ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPremiumLoading, setIsPremiumLoading] = useState(true);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

    // Fetch user profile
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    };

    // Initialize auth state
    useEffect(() => {
        let isMounted = true;

        // Set up auth state change listener FIRST
        // This handles both initial session load and subsequent changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!isMounted) return;

                setSession(session);
                // Preserve user object reference on token refresh to avoid cascading re-renders
                setUser(prev => {
                    const newUser = session?.user ?? null;
                    if (prev?.id === newUser?.id) return prev;
                    return newUser;
                });

                if (session?.user) {
                    // Fetch profile in background
                    fetchProfile(session.user.id).then(userProfile => {
                        if (isMounted) {
                            setProfile(userProfile);
                        }
                    });
                } else {
                    setProfile(null);
                }

                // Only set loading false after processing
                setIsLoading(false);
            }
        );

        // Also call getSession to handle existing session
        // This is a backup in case onAuthStateChange doesn't fire immediately
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!isMounted) return;

                // Only update if we haven't received an auth state change yet
                if (isLoading) {
                    setSession(session);
                    setUser(session?.user ?? null);

                    if (session?.user) {
                        const userProfile = await fetchProfile(session.user.id);
                        if (isMounted) {
                            setProfile(userProfile);
                        }
                    }
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error checking session:', error);
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        // Small delay to let onAuthStateChange fire first
        const timeoutId = setTimeout(checkSession, 100);

        // Cleanup
        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    // Sign up
    const signUp = async (
        email: string,
        password: string,
        metadata?: { username?: string; display_name?: string }
    ): Promise<SignUpResult> => {
        setIsLoading(true);
        try {
            const data = await auth.signUp(email, password, metadata);

            // Check if email confirmation is required
            // If user exists but session is null, email confirmation is pending
            const requiresEmailConfirmation = !!data.user && !data.session;

            return {
                requiresEmailConfirmation,
                email,
            };
        } finally {
            setIsLoading(false);
        }
    };

    // Sign in
    const signIn = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            await auth.signIn(email, password);
        } finally {
            setIsLoading(false);
        }
    };

    // Sign out
    const signOut = async () => {
        setIsLoading(true);
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
            // Continue with local cleanup even if server signout fails
        } finally {
            // Always clear local state
            setUser(null);
            setProfile(null);
            setSession(null);
            setIsLoading(false);
        }
    };

    // Reset password
    const resetPassword = async (email: string) => {
        await auth.resetPassword(email);
    };

    // Update profile
    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) throw new Error('No user logged in');

        const { error } = await supabase
            .from('profiles')
            .update(updates as never)
            .eq('id', user.id);

        if (error) throw error;

        // Refresh profile after update
        await refreshProfile();
    };

    // Refresh profile
    const refreshProfile = async () => {
        if (!user) return;
        const userProfile = await fetchProfile(user.id);
        setProfile(userProfile);
    };

    // Check premium status via database function
    const premiumCheckedRef = useRef(false);
    const checkPremiumStatus = useCallback(async (userId: string) => {
        try {
            // Only show loading spinner for the initial check, not background refreshes
            if (!premiumCheckedRef.current) {
                setIsPremiumLoading(true);
            }
            const { data, error } = await supabase.rpc('has_premium_access', { p_user_id: userId });
            if (error) {
                console.error('Error checking premium status:', error);
                setHasActiveSubscription(false);
            } else {
                setHasActiveSubscription(data ?? false);
            }
        } catch (error) {
            console.error('Error checking premium status:', error);
            setHasActiveSubscription(false);
        } finally {
            setIsPremiumLoading(false);
            premiumCheckedRef.current = true;
        }
    }, []);

    // Refresh premium status
    const refreshPremiumStatus = async () => {
        if (!user) return;
        await checkPremiumStatus(user.id);
    };

    // Check premium status when user changes
    useEffect(() => {
        if (user) {
            checkPremiumStatus(user.id);
        } else {
            setHasActiveSubscription(false);
            setIsPremiumLoading(false);
        }
    }, [user, checkPremiumStatus]);

    // Platform role helpers
    const userRole = profile?.role || 'user';
    const isPlatformAdmin = userRole === 'admin' || userRole === 'superadmin';
    const isPlatformModerator = userRole === 'moderator' || isPlatformAdmin;
    const isSuperAdmin = userRole === 'superadmin';

    // Memoize ban status to avoid creating new objects every render
    const banInfo = useMemo((): BanInfo | null => {
        if (!profile) return null;

        const isBannedFlag = profile.is_banned ?? false;
        if (!isBannedFlag) {
            return { isBanned: false, reason: null, expiresAt: null, isPermanent: false };
        }

        const expiresAt = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
        const isExpired = expiresAt && expiresAt <= new Date();

        if (isExpired) {
            return { isBanned: false, reason: null, expiresAt: null, isPermanent: false };
        }

        return {
            isBanned: true,
            reason: profile.ban_reason ?? null,
            expiresAt,
            isPermanent: expiresAt === null,
        };
    }, [profile]);

    const isBanned = banInfo?.isBanned ?? false;

    // Membership type from profile
    const membershipType = (profile?.membership_type as MembershipType) ?? null;

    // User is premium if either:
    // 1. membership_type is 'premium' in profile
    // 2. has_premium_access returns true (which also checks active subscriptions)
    // 3. User is a platform admin or moderator (they get premium access automatically)
    const isPremium = membershipType === 'premium' || hasActiveSubscription || isPlatformAdmin || isPlatformModerator;

    // Check if email is confirmed
    const isEmailConfirmed = !!user?.email_confirmed_at;

    // Memoize stable auth methods to prevent unnecessary re-renders
    const signUpCb = useCallback(signUp, []);
    const signInCb = useCallback(signIn, []);
    const signOutCb = useCallback(signOut, []);
    const resetPasswordCb = useCallback(resetPassword, []);
    const updateProfileCb = useCallback(updateProfile, [user]);
    const refreshProfileCb = useCallback(refreshProfile, [user]);
    const refreshPremiumStatusCb = useCallback(refreshPremiumStatus, [user]);

    // Memoize context value to prevent all consumers from re-rendering on every parent render
    const value = useMemo<AuthContextType>(() => ({
        user,
        profile,
        session,
        isLoading,
        isAuthenticated: !!user,
        isEmailConfirmed,
        isBanned,
        banInfo,
        isPlatformAdmin,
        isPlatformModerator,
        isSuperAdmin,
        membershipType,
        isPremium,
        isPremiumLoading,
        signUp: signUpCb,
        signIn: signInCb,
        signOut: signOutCb,
        resetPassword: resetPasswordCb,
        updateProfile: updateProfileCb,
        refreshProfile: refreshProfileCb,
        refreshPremiumStatus: refreshPremiumStatusCb,
    }), [
        user, profile, session, isLoading, isEmailConfirmed,
        isBanned, banInfo, isPlatformAdmin, isPlatformModerator,
        isSuperAdmin, membershipType, isPremium, isPremiumLoading,
        signUpCb, signInCb, signOutCb, resetPasswordCb,
        updateProfileCb, refreshProfileCb, refreshPremiumStatusCb,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Hook to use auth context
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
