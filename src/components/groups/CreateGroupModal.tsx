import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Globe, Upload, Loader2, Crown, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createGroup, updateGroup, generateSlug, isSlugAvailable } from '@/services/group';
import { uploadImage } from '@/services/s3';
import type { Group, GroupInsert, GroupUpdate } from '@/types';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (group: Group) => void;
    editingGroup?: Group | null;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    onSuccess,
    editingGroup = null,
}: CreateGroupModalProps) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isPremiumGroup, setIsPremiumGroup] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [slugError, setSlugError] = useState<string | null>(null);

    const isEditing = !!editingGroup;

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (editingGroup) {
                setName(editingGroup.name);
                setSlug(editingGroup.slug);
                setDescription(editingGroup.description || '');
                setIsPrivate(editingGroup.is_private ?? false);
                setIsPremiumGroup(editingGroup.is_premium ?? false);
                setAvatarPreview(editingGroup.avatar_url);
                setCoverPreview(editingGroup.cover_url);
            } else {
                setName('');
                setSlug('');
                setDescription('');
                setIsPrivate(false);
                setIsPremiumGroup(false);
                setAvatarPreview(null);
                setCoverPreview(null);
            }
            setAvatarFile(null);
            setCoverFile(null);
            setError(null);
            setSlugError(null);
        }
    }, [isOpen, editingGroup]);

    // Auto-generate slug from name
    useEffect(() => {
        if (!isEditing && name) {
            const newSlug = generateSlug(name);
            setSlug(newSlug);
        }
    }, [name, isEditing]);

    // Validate slug availability
    useEffect(() => {
        const validateSlug = async () => {
            if (!slug) {
                setSlugError(null);
                return;
            }

            try {
                const available = await isSlugAvailable(slug, editingGroup?.id);
                if (!available) {
                    setSlugError('This URL is already taken');
                } else {
                    setSlugError(null);
                }
            } catch {
                // Ignore errors during validation
            }
        };

        const timeout = setTimeout(validateSlug, 300);
        return () => clearTimeout(timeout);
    }, [slug, editingGroup?.id]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (slugError) return;

        setError(null);
        setIsSubmitting(true);

        try {
            // Upload images if provided
            let avatarUrl = editingGroup?.avatar_url || null;
            let coverUrl = editingGroup?.cover_url || null;

            if (avatarFile) {
                const result = await uploadImage(avatarFile);
                avatarUrl = result.url;
            }

            if (coverFile) {
                const result = await uploadImage(coverFile);
                coverUrl = result.url;
            }

            let group: Group;

            if (isEditing && editingGroup) {
                const updates: GroupUpdate = {
                    name,
                    slug,
                    description: description || null,
                    is_private: isPrivate,
                    is_premium: isPremiumGroup,
                    avatar_url: avatarUrl,
                    cover_url: coverUrl,
                };
                group = await updateGroup(editingGroup.id, updates);
            } else {
                const newGroup: GroupInsert = {
                    name,
                    slug,
                    description: description || null,
                    is_private: isPrivate,
                    is_premium: isPremiumGroup,
                    avatar_url: avatarUrl,
                    cover_url: coverUrl,
                    created_by: user.id,
                };
                group = await createGroup(newGroup);
            }

            onSuccess(group);
            onClose();
        } catch (err) {
            console.error('Error saving group:', err);
            setError(err instanceof Error ? err.message : 'Failed to save group');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-surface-100 dark:border-surface-700">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
                        {isEditing ? 'Edit Classroom' : 'Create New Classroom'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Cover image upload */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Cover Image
                        </label>
                        <div className="relative h-32 bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden">
                            {coverPreview ? (
                                <img
                                    src={coverPreview}
                                    alt="Cover preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-surface-400 dark:text-surface-500">
                                    <Upload className="w-8 h-8" />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoverChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Avatar upload */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Classroom Avatar
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-xl overflow-hidden">
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Avatar preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-surface-400 dark:text-surface-500">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                            <p className="text-sm text-surface-500 dark:text-surface-400">
                                Click to upload a classroom avatar
                            </p>
                        </div>
                    </div>

                    {/* Classroom name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Classroom Name *
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., JavaScript Developers"
                            className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            required
                            minLength={2}
                            maxLength={100}
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label htmlFor="slug" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            URL
                        </label>
                        <div className="flex items-center">
                            <span className="text-surface-500 dark:text-surface-400 text-sm mr-1">/classrooms/</span>
                            <input
                                type="text"
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="javascript-developers"
                                className={`flex-1 px-4 py-2.5 border rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${slugError ? 'border-red-300 dark:border-red-700' : 'border-surface-200 dark:border-surface-700'
                                    }`}
                                required
                            />
                        </div>
                        {slugError && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{slugError}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this classroom about?"
                            rows={3}
                            className="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Privacy toggle */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                            Privacy
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPrivate(false)}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${!isPrivate
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }`}
                            >
                                <Globe className={`w-5 h-5 ${!isPrivate ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                <div className="text-left">
                                    <p className={`font-medium ${!isPrivate ? 'text-primary-900 dark:text-primary-100' : 'text-surface-700 dark:text-surface-300'}`}>
                                        Public
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400">Anyone can find and join</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(true)}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${isPrivate
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }`}
                            >
                                <Lock className={`w-5 h-5 ${isPrivate ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                <div className="text-left">
                                    <p className={`font-medium ${isPrivate ? 'text-primary-900 dark:text-primary-100' : 'text-surface-700 dark:text-surface-300'}`}>
                                        Private
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400">Invite only</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Access Type toggle (Free/Premium) */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                            Access Type
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPremiumGroup(false)}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${!isPremiumGroup
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }`}
                            >
                                <Users className={`w-5 h-5 ${!isPremiumGroup ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                <div className="text-left">
                                    <p className={`font-medium ${!isPremiumGroup ? 'text-primary-900 dark:text-primary-100' : 'text-surface-700 dark:text-surface-300'}`}>
                                        Free Access
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400">All members can join</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPremiumGroup(true)}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${isPremiumGroup
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                    }`}
                            >
                                <Crown className={`w-5 h-5 ${isPremiumGroup ? 'text-amber-600 dark:text-amber-400' : 'text-surface-400 dark:text-surface-500'}`} />
                                <div className="text-left">
                                    <p className={`font-medium ${isPremiumGroup ? 'text-amber-900 dark:text-amber-100' : 'text-surface-700 dark:text-surface-300'}`}>
                                        Premium Only
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400">Premium members only</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Submit button */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name || !slug || !!slugError}
                            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Create Classroom'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
