import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile, isUsernameAvailable, isValidUsername, isValidWebsite } from '@/services/profile';
import { uploadImage } from '@/services/s3';
import { supabase } from '@/services/supabase';
import {
    getNotificationPreferences,
    updateNotificationPreferences,
    type NotificationPreferences,
} from '@/services/notification';
import AvatarUpload from '@/components/profile/AvatarUpload';
import SubscriptionBadge from '@/components/common/SubscriptionBadge';
import { subscriptionService } from '@/services/subscription';
import ChangePasswordModal from '@/components/settings/ChangePasswordModal';
import TwoFactorSetupModal from '@/components/settings/TwoFactorSetupModal';
import TwoFactorDisableModal from '@/components/settings/TwoFactorDisableModal';
import {
    User,
    AtSign,
    FileText,
    MapPin,
    Link as LinkIcon,
    Loader2,
    Check,
    X,
    AlertCircle,
    Settings as SettingsIcon,
    CreditCard,
    Shield,
    Bell,
    ShieldCheck,
    ShieldOff,
    ImageIcon,
    Trash2,
} from 'lucide-react';

type SettingsTab = 'profile' | 'account' | 'subscription' | 'notifications';

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Shield },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
    const [is2FADisableModalOpen, setIs2FADisableModalOpen] = useState(false);
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [is2FALoading, setIs2FALoading] = useState(true);

    // Notification preferences state
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
    const [isPrefsLoading, setIsPrefsLoading] = useState(true);
    const [isPrefsSaving, setIsPrefsSaving] = useState(false);
    const [prefsSaved, setPrefsSaved] = useState(false);
    const [prefsError, setPrefsError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        display_name: '',
        username: '',
        bio: '',
        location: '',
        website: '',
    });
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [isCoverUploading, setIsCoverUploading] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

    // Fetch 2FA status
    const fetch2FAStatus = useCallback(async () => {
        if (!user) return;

        try {
            setIs2FALoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${apiUrl}/api/2fa/status`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setIs2FAEnabled(data.enabled);
            }
        } catch (err) {
            console.error('Failed to fetch 2FA status:', err);
        } finally {
            setIs2FALoading(false);
        }
    }, [user]);

    // Initialize form with profile data
    useEffect(() => {
        if (profile) {
            setFormData({
                display_name: profile.display_name || '',
                username: profile.username || '',
                bio: profile.bio || '',
                location: profile.location || '',
                website: profile.website || '',
            });
            setAvatarUrl(profile.avatar_url);
            setCoverUrl(profile.cover_url || null);
        }
    }, [profile]);

    // Fetch 2FA status on mount
    useEffect(() => {
        fetch2FAStatus();
    }, [fetch2FAStatus]);

    // Fetch notification preferences on mount
    useEffect(() => {
        async function loadNotificationPreferences() {
            if (!user) return;
            try {
                setIsPrefsLoading(true);
                const prefs = await getNotificationPreferences(user.id);
                setNotificationPrefs(prefs);
            } catch (err) {
                console.error('Failed to load notification preferences:', err);
                setPrefsError('Failed to load notification preferences');
            } finally {
                setIsPrefsLoading(false);
            }
        }
        loadNotificationPreferences();
    }, [user]);

    // Handle notification preference change
    const handlePrefChange = (key: keyof NotificationPreferences, value: boolean) => {
        if (!notificationPrefs) return;
        setNotificationPrefs({ ...notificationPrefs, [key]: value });
        setPrefsSaved(false);
        setPrefsError(null);
    };

    // Save notification preferences
    const handleSavePreferences = async () => {
        if (!user || !notificationPrefs) return;

        setIsPrefsSaving(true);
        setPrefsError(null);

        try {
            await updateNotificationPreferences(user.id, notificationPrefs);
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save notification preferences:', err);
            setPrefsError('Failed to save preferences. Please try again.');
        } finally {
            setIsPrefsSaving(false);
        }
    };

    // Check username availability with debounce
    useEffect(() => {
        const checkUsername = async () => {
            const username = formData.username.toLowerCase().trim();

            // Skip if same as current username
            if (profile && username === profile.username) {
                setUsernameStatus('idle');
                return;
            }

            // Validate format
            if (!isValidUsername(username)) {
                if (username.length > 0) {
                    setUsernameStatus('invalid');
                } else {
                    setUsernameStatus('idle');
                }
                return;
            }

            setUsernameStatus('checking');

            try {
                const available = await isUsernameAvailable(username, user?.id);
                setUsernameStatus(available ? 'available' : 'taken');
            } catch {
                setUsernameStatus('idle');
            }
        };

        const timeout = setTimeout(checkUsername, 500);
        return () => clearTimeout(timeout);
    }, [formData.username, profile, user?.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setIsSaved(false);
    };

    const handleAvatarUpload = async (url: string) => {
        setAvatarUrl(url);

        // Update profile immediately
        if (user) {
            try {
                await updateProfile(user.id, { avatar_url: url });
                await refreshProfile();
            } catch (err) {
                console.error('Failed to update avatar:', err);
            }
        }
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsCoverUploading(true);
        try {
            const result = await uploadImage(file);
            setCoverUrl(result.url);
            await updateProfile(user.id, { cover_url: result.url });
            await refreshProfile();
        } catch (err) {
            console.error('Failed to upload cover photo:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload cover photo');
        } finally {
            setIsCoverUploading(false);
        }
    };

    const handleRemoveCover = async () => {
        if (!user) return;
        setIsCoverUploading(true);
        try {
            await updateProfile(user.id, { cover_url: null });
            setCoverUrl(null);
            await refreshProfile();
        } catch (err) {
            console.error('Failed to remove cover photo:', err);
        } finally {
            setIsCoverUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError(null);

        // Validate
        if (!formData.display_name.trim()) {
            setError('Display name is required');
            return;
        }

        if (!isValidUsername(formData.username)) {
            setError('Username must be 3-30 characters, letters, numbers, underscores, or hyphens only');
            return;
        }

        if (usernameStatus === 'taken') {
            setError('Username is already taken');
            return;
        }

        if (formData.website && !isValidWebsite(formData.website)) {
            setError('Please enter a valid website URL');
            return;
        }

        if (formData.bio.length > 500) {
            setError('Bio must be 500 characters or less');
            return;
        }

        setIsLoading(true);

        try {
            await updateProfile(user.id, {
                display_name: formData.display_name.trim(),
                username: formData.username.toLowerCase().trim(),
                bio: formData.bio.trim() || null,
                location: formData.location.trim() || null,
                website: formData.website.trim() || null,
            });

            await refreshProfile();
            setIsSaved(true);

            // Clear saved indicator after 3 seconds
            setTimeout(() => setIsSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user || !profile) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-3">
                    <SettingsIcon className="w-7 h-7 text-primary-600" />
                    Settings
                </h1>
                <p className="text-surface-500 dark:text-surface-400 mt-1">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-56 flex-shrink-0">
                    <nav className="lg:sticky lg:top-6 space-y-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                                        ${isActive
                                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                                        }
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="card shadow-none p-6 sm:p-8">
                            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                                Profile Information
                            </h2>

                            {/* Cover Photo */}
                            <div className="mb-8 pb-8 border-b border-surface-200 dark:border-surface-700">
                                <h3 className="font-medium text-surface-900 dark:text-surface-100 mb-3">
                                    Cover Photo
                                </h3>
                                <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600">
                                    {coverUrl && (
                                        <img
                                            src={coverUrl}
                                            alt="Cover"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    {isCoverUploading && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-surface-800/90 text-surface-700 dark:text-surface-200 text-sm font-medium rounded-lg hover:bg-white dark:hover:bg-surface-800 transition-colors">
                                            <ImageIcon className="w-4 h-4" />
                                            <span>{coverUrl ? 'Change' : 'Upload'}</span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                className="hidden"
                                                onChange={handleCoverUpload}
                                                disabled={isCoverUploading}
                                            />
                                        </label>
                                        {coverUrl && (
                                            <button
                                                onClick={handleRemoveCover}
                                                disabled={isCoverUploading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Remove</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
                                    Recommended size: 1200x400px. JPG, PNG, GIF or WebP.
                                </p>
                            </div>

                            {/* Avatar */}
                            <div className="flex items-center gap-6 mb-8 pb-8 border-b border-surface-200 dark:border-surface-700">
                                <AvatarUpload
                                    currentUrl={avatarUrl}
                                    displayName={formData.display_name}
                                    userId={user.id}
                                    onUpload={handleAvatarUpload}
                                    size="xl"
                                />
                                <div>
                                    <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                        Profile Photo
                                    </h3>
                                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                        Click to upload a new photo. JPG, PNG or GIF, max 5MB.
                                    </p>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Error message */}
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Success message */}
                                {isSaved && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
                                        <Check className="w-4 h-4" />
                                        <span>Profile saved successfully!</span>
                                    </div>
                                )}

                                {/* Two column layout for name fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Display Name */}
                                    <div>
                                        <label htmlFor="display_name" className="label">
                                            Display Name
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                            <input
                                                id="display_name"
                                                name="display_name"
                                                type="text"
                                                value={formData.display_name}
                                                onChange={handleChange}
                                                placeholder="Your name"
                                                required
                                                maxLength={100}
                                                className="input pl-10"
                                            />
                                        </div>
                                    </div>

                                    {/* Username */}
                                    <div>
                                        <label htmlFor="username" className="label">
                                            Username
                                        </label>
                                        <div className="relative">
                                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                            <input
                                                id="username"
                                                name="username"
                                                type="text"
                                                value={formData.username}
                                                onChange={handleChange}
                                                placeholder="username"
                                                required
                                                pattern="^[a-zA-Z0-9_\-]+$"
                                                maxLength={30}
                                                className="input pl-10 pr-10"
                                            />
                                            {/* Username status indicator */}
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {usernameStatus === 'checking' && (
                                                    <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                                                )}
                                                {usernameStatus === 'available' && (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                )}
                                                {usernameStatus === 'taken' && (
                                                    <X className="w-4 h-4 text-red-500" />
                                                )}
                                                {usernameStatus === 'invalid' && (
                                                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                                            3-30 characters. Letters, numbers, underscores, and hyphens only.
                                        </p>
                                    </div>
                                </div>

                                {/* Bio */}
                                <div>
                                    <label htmlFor="bio" className="label">
                                        Bio
                                    </label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-3 w-4 h-4 text-surface-400" />
                                        <textarea
                                            id="bio"
                                            name="bio"
                                            value={formData.bio}
                                            onChange={handleChange}
                                            placeholder="Tell us about yourself..."
                                            rows={4}
                                            maxLength={500}
                                            className="input pl-10 resize-none"
                                        />
                                    </div>
                                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 text-right">
                                        {formData.bio.length}/500
                                    </p>
                                </div>

                                {/* Two column layout for location and website */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Location */}
                                    <div>
                                        <label htmlFor="location" className="label">
                                            Location
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                            <input
                                                id="location"
                                                name="location"
                                                type="text"
                                                value={formData.location}
                                                onChange={handleChange}
                                                placeholder="City, Country"
                                                maxLength={100}
                                                className="input pl-10"
                                            />
                                        </div>
                                    </div>

                                    {/* Website */}
                                    <div>
                                        <label htmlFor="website" className="label">
                                            Website
                                        </label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                            <input
                                                id="website"
                                                name="website"
                                                type="url"
                                                value={formData.website}
                                                onChange={handleChange}
                                                placeholder="https://yourwebsite.com"
                                                className="input pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isLoading || usernameStatus === 'taken' || usernameStatus === 'checking'}
                                        className="btn-primary px-8 py-2.5"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Changes</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Account Tab */}
                    {activeTab === 'account' && (
                        <div className="space-y-6">
                            {/* Email Section */}
                            <div className="card shadow-none p-6 sm:p-8">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                                    Email Address
                                </h2>
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        value={user.email || ''}
                                        disabled
                                        className="input bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400 cursor-not-allowed"
                                    />
                                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
                                        Contact support to change your email address.
                                    </p>
                                </div>
                            </div>

                            {/* Security Section */}
                            <div className="card shadow-none p-6 sm:p-8">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                                    Security
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                        <div>
                                            <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                                Password
                                            </h3>
                                            <p className="text-sm text-surface-500 dark:text-surface-400">
                                                Keep your account secure with a strong password
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsChangePasswordModalOpen(true)}
                                            className="btn-secondary px-4 py-2 text-sm"
                                        >
                                            Change Password
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {is2FAEnabled ? (
                                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                                    <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-surface-200 dark:bg-surface-700 rounded-lg">
                                                    <ShieldOff className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                                    Two-Factor Authentication
                                                </h3>
                                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                                    {is2FAEnabled
                                                        ? 'Your account is protected with 2FA'
                                                        : 'Add an extra layer of security to your account'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        {is2FALoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-surface-400" />
                                        ) : is2FAEnabled ? (
                                            <button
                                                onClick={() => setIs2FADisableModalOpen(true)}
                                                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                Disable 2FA
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setIs2FASetupModalOpen(true)}
                                                className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                            >
                                                Enable 2FA
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="card shadow-none p-6 sm:p-8 border-red-200 dark:border-red-900">
                                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
                                    Danger Zone
                                </h2>
                                <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                                    Once you delete your account, there is no going back. Please be certain.
                                </p>
                                <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Subscription Tab */}
                    {activeTab === 'subscription' && (
                        <div className="card shadow-none p-6 sm:p-8">
                            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                                Subscription Status
                            </h2>

                            <div className="mb-6">
                                <SubscriptionBadge showDetails />
                            </div>

                            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-6 space-y-4">
                                <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                    Membership Benefits
                                </h3>
                                <ul className="space-y-3">
                                    {[
                                        'Access to all community features',
                                        'Participate in exclusive groups',
                                        'Submit projects to showcase',
                                        'Direct messaging with members',
                                        'Priority support',
                                    ].map((benefit, index) => (
                                        <li key={index} className="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400">
                                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        const url = await subscriptionService.createPortalSession();
                                        window.location.href = url;
                                    } catch {
                                        // User may not have a Stripe customer yet
                                    }
                                }}
                                className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                            >
                                Manage Subscription
                            </button>
                            <p className="text-sm text-surface-500 dark:text-surface-400 mt-3">
                                Manage your subscription via Stripe. Changes may take a few minutes to reflect here.
                            </p>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            {/* Email Notifications */}
                            <div className="card shadow-none p-6 sm:p-8">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                                    Email Notifications
                                </h2>
                                <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
                                    Choose which notifications you want to receive via email.
                                </p>

                                {isPrefsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Error message */}
                                        {prefsError && (
                                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                <span>{prefsError}</span>
                                            </div>
                                        )}

                                        {/* Success message */}
                                        {prefsSaved && (
                                            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
                                                <Check className="w-4 h-4" />
                                                <span>Notification preferences saved successfully!</span>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            {[
                                                { id: 'email_comments' as const, label: 'Comments on your posts', description: 'Get an email when someone comments on your posts' },
                                                { id: 'email_replies' as const, label: 'Replies to your comments', description: 'Get an email when someone replies to your comments' },
                                                { id: 'email_mentions' as const, label: 'Mentions', description: 'Get an email when someone @mentions you in a comment' },
                                                { id: 'email_messages' as const, label: 'Direct messages', description: 'Get an email when you receive a new direct message' },
                                                { id: 'email_announcements' as const, label: 'Community announcements', description: 'Receive important updates about the community' },
                                            ].map((item) => (
                                                <div key={item.id} className="flex items-center justify-between py-4 border-b border-surface-100 dark:border-surface-800 last:border-0">
                                                    <div>
                                                        <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                                            {item.label}
                                                        </h3>
                                                        <p className="text-sm text-surface-500 dark:text-surface-400">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={notificationPrefs?.[item.id] ?? true}
                                                            onChange={(e) => handlePrefChange(item.id, e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-primary-600"></div>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* In-App Notifications */}
                            <div className="card shadow-none p-6 sm:p-8">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                                    In-App Notifications
                                </h2>
                                <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
                                    Choose which notifications appear in your notification center.
                                </p>

                                {isPrefsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {[
                                            { id: 'notify_comments' as const, label: 'Comments', description: 'When someone comments on your posts' },
                                            { id: 'notify_replies' as const, label: 'Replies', description: 'When someone replies to your comments' },
                                            { id: 'notify_mentions' as const, label: 'Mentions', description: 'When someone @mentions you' },
                                            { id: 'notify_messages' as const, label: 'Messages', description: 'When you receive a direct message' },
                                            { id: 'notify_reactions' as const, label: 'Reactions', description: 'When someone reacts to your content' },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center justify-between py-4 border-b border-surface-100 dark:border-surface-800 last:border-0">
                                                <div>
                                                    <h3 className="font-medium text-surface-900 dark:text-surface-100">
                                                        {item.label}
                                                    </h3>
                                                    <p className="text-sm text-surface-500 dark:text-surface-400">
                                                        {item.description}
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={notificationPrefs?.[item.id] ?? true}
                                                        onChange={(e) => handlePrefChange(item.id, e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-primary-600"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            {!isPrefsLoading && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSavePreferences}
                                        disabled={isPrefsSaving}
                                        className="btn-primary px-8 py-2.5"
                                    >
                                        {isPrefsSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Preferences</span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Change Password Modal */}
            <ChangePasswordModal
                isOpen={isChangePasswordModalOpen}
                onClose={() => setIsChangePasswordModalOpen(false)}
            />

            {/* 2FA Setup Modal */}
            <TwoFactorSetupModal
                isOpen={is2FASetupModalOpen}
                onClose={() => setIs2FASetupModalOpen(false)}
                onSuccess={() => {
                    setIs2FAEnabled(true);
                    fetch2FAStatus();
                }}
            />

            {/* 2FA Disable Modal */}
            <TwoFactorDisableModal
                isOpen={is2FADisableModalOpen}
                onClose={() => setIs2FADisableModalOpen(false)}
                onSuccess={() => {
                    setIs2FAEnabled(false);
                    fetch2FAStatus();
                }}
            />
        </div>
    );
}
