import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Loader2,
    Upload,
    X,
    Plus,
    Link as LinkIcon,
    Info,
    RotateCcw,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import RichTextEditor from '@/components/feed/RichTextEditor';
import {
    createShowcase,
    addShowcaseImage,
    getAllTags,
    setShowcaseTags,
} from '@/services/showcase';
import { uploadImage } from '@/services';
import type { ShowcaseTag, ShowcaseCategory } from '@/types/database';
import { SHOWCASE_CATEGORY_INFO } from '@/types/showcase';

const CATEGORY_OPTIONS = Object.entries(SHOWCASE_CATEGORY_INFO).map(([value, info]) => ({
    value: value as ShowcaseCategory,
    label: info.label,
    icon: info.icon,
    color: info.color,
}));

const DRAFT_STORAGE_KEY = 'showcase_submit_draft';

interface DraftData {
    title: string;
    tagline: string;
    description: string;
    url: string;
    category: ShowcaseCategory;
    techStack: string[];
    selectedTags: string[];
    thumbnailUrl: string | null;
    imageUrls: string[];
    step: number;
    savedAt: number;
}

export default function ShowcaseSubmit() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Form state
    const [title, setTitle] = useState('');
    const [tagline, setTagline] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState<ShowcaseCategory>('web_app');
    const [techStack, setTechStack] = useState<string[]>([]);
    const [techInput, setTechInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<ShowcaseTag[]>([]);

    // Image state
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
    const [isUploadingImages, setIsUploadingImages] = useState(false);

    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [hasDraft, setHasDraft] = useState(false);
    const [showDraftNotice, setShowDraftNotice] = useState(false);

    // Track if draft was already loaded to prevent re-loading
    const draftLoadedRef = useRef(false);

    // Load draft from localStorage on mount
    useEffect(() => {
        if (draftLoadedRef.current) return;

        try {
            const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (savedDraft) {
                const draft: DraftData = JSON.parse(savedDraft);

                // Check if draft is less than 7 days old
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - draft.savedAt < sevenDaysMs) {
                    // Restore draft data
                    setTitle(draft.title);
                    setTagline(draft.tagline);
                    setDescription(draft.description);
                    setUrl(draft.url);
                    setCategory(draft.category);
                    setTechStack(draft.techStack);
                    setSelectedTags(draft.selectedTags);
                    setThumbnailUrl(draft.thumbnailUrl);
                    setImageUrls(draft.imageUrls);
                    setStep(draft.step);
                    setHasDraft(true);
                    setShowDraftNotice(true);

                    // Auto-hide the notice after 5 seconds
                    setTimeout(() => setShowDraftNotice(false), 5000);
                } else {
                    // Clear expired draft
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                }
            }
        } catch (err) {
            console.error('Error loading draft:', err);
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        }

        draftLoadedRef.current = true;
    }, []);

    // Save draft to localStorage when form changes
    useEffect(() => {
        // Don't save if draft hasn't been loaded yet (initial render)
        if (!draftLoadedRef.current) return;

        // Only save if there's meaningful content
        const hasContent = title || tagline || description || url ||
                          techStack.length > 0 || thumbnailUrl || imageUrls.length > 0;

        if (hasContent) {
            const draft: DraftData = {
                title,
                tagline,
                description,
                url,
                category,
                techStack,
                selectedTags,
                thumbnailUrl,
                imageUrls,
                step,
                savedAt: Date.now(),
            };

            try {
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
                setHasDraft(true);
            } catch (err) {
                console.error('Error saving draft:', err);
            }
        }
    }, [title, tagline, description, url, category, techStack, selectedTags, thumbnailUrl, imageUrls, step]);

    // Clear draft from localStorage
    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setTitle('');
        setTagline('');
        setDescription('');
        setUrl('');
        setCategory('web_app');
        setTechStack([]);
        setSelectedTags([]);
        setThumbnailUrl(null);
        setImageUrls([]);
        setStep(1);
        setHasDraft(false);
        setShowDraftNotice(false);
    }, []);

    // Load tags
    useEffect(() => {
        getAllTags().then(setAvailableTags);
    }, []);

    // Thumbnail upload
    const handleThumbnailUpload = useCallback(async (files: File[]) => {
        if (!user || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Thumbnail must be less than 5MB');
            return;
        }

        setIsUploadingThumbnail(true);
        setError(null);

        try {
            const result = await uploadImage(file);
            setThumbnailUrl(result.url);
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Failed to upload thumbnail');
        } finally {
            setIsUploadingThumbnail(false);
        }
    }, [user]);

    // Screenshots upload
    const handleImagesUpload = useCallback(async (files: File[]) => {
        if (!user || files.length === 0) return;

        setIsUploadingImages(true);
        setError(null);

        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                if (file.size > 10 * 1024 * 1024) continue;

                const result = await uploadImage(file);
                setImageUrls((prev) => [...prev, result.url]);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Failed to upload images');
        } finally {
            setIsUploadingImages(false);
        }
    }, [user]);

    // Dropzone for thumbnail
    const thumbnailDropzone = useDropzone({
        onDrop: handleThumbnailUpload,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        multiple: false,
        maxSize: 5 * 1024 * 1024,
    });

    // Dropzone for screenshots
    const imagesDropzone = useDropzone({
        onDrop: handleImagesUpload,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
        multiple: true,
        maxSize: 10 * 1024 * 1024,
    });

    // Add tech stack item
    const addTech = () => {
        if (techInput.trim() && !techStack.includes(techInput.trim())) {
            setTechStack([...techStack, techInput.trim()]);
            setTechInput('');
        }
    };

    // Remove tech stack item
    const removeTech = (tech: string) => {
        setTechStack(techStack.filter((t) => t !== tech));
    };

    // Toggle tag selection
    const toggleTag = (tagId: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    // Remove screenshot
    const removeImage = (index: number) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
    };

    // Validate URL
    const isValidUrl = (urlString: string) => {
        try {
            new URL(urlString);
            return true;
        } catch {
            return false;
        }
    };

    // Validate step 1
    const canProceedStep1 = title.length >= 3 && tagline.length >= 10 && url && isValidUrl(url);

    // Validate step 2
    const canProceedStep2 = description.length >= 50;

    // Submit
    const handleSubmit = async () => {
        if (!user) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Create showcase
            const showcase = await createShowcase({
                title,
                tagline,
                description,
                url,
                category,
                tech_stack: techStack,
                author_id: user.id,
                thumbnail_url: thumbnailUrl,
            });

            // Add images
            for (let i = 0; i < imageUrls.length; i++) {
                await addShowcaseImage(showcase.id, imageUrls[i], i);
            }

            // Set tags
            if (selectedTags.length > 0) {
                await setShowcaseTags(showcase.id, selectedTags);
            }

            // Clear draft on successful submission
            localStorage.removeItem(DRAFT_STORAGE_KEY);

            // Navigate to success or my showcases
            navigate('/showcase', {
                state: { submitted: true },
            });
        } catch (err) {
            console.error('Error submitting showcase:', err);
            setError('Failed to submit showcase. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Draft Restored Notice */}
            {showDraftNotice && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                    <p className="text-sm text-green-700 dark:text-green-400">
                        Your previous draft has been restored.
                    </p>
                    <button
                        onClick={() => setShowDraftNotice(false)}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/showcase')}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                        Submit Your Project
                    </h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-1">
                        Share what you've built with the community
                    </p>
                </div>
                {hasDraft && (
                    <button
                        onClick={clearDraft}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                        title="Clear saved draft and start fresh"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Clear Draft</span>
                    </button>
                )}
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4 mb-8">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div
                            className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm
                                ${step >= s
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                                }
                            `}
                        >
                            {s}
                        </div>
                        <span className={`text-sm hidden sm:block ${step >= s ? 'text-surface-900 dark:text-surface-100' : 'text-surface-500'}`}>
                            {s === 1 ? 'Basic Info' : s === 2 ? 'Description' : 'Media & Tags'}
                        </span>
                        {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary-600' : 'bg-surface-200 dark:bg-surface-700'}`} />}
                    </div>
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Step 1: Basic Info */}
            {step === 1 && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Project Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="My Awesome Project"
                            maxLength={255}
                            className="w-full px-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-surface-500 mt-1">{title.length}/255 characters</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Tagline * <span className="font-normal text-surface-500">(Short description)</span>
                        </label>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            placeholder="The best tool for doing amazing things"
                            maxLength={150}
                            className="w-full px-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-surface-500 mt-1">{tagline.length}/150 characters (min 10)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Project URL *
                        </label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://myproject.com"
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        {url && !isValidUrl(url) && (
                            <p className="text-xs text-red-500 mt-1">Please enter a valid URL</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Category *
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {CATEGORY_OPTIONS.map((cat) => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    className={`
                                        p-3 rounded-lg border text-sm font-medium transition-colors text-left
                                        ${category === cat.value
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-700 dark:text-surface-300'
                                        }
                                    `}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={() => setStep(2)}
                            disabled={!canProceedStep1}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Description */}
            {step === 2 && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Full Description *
                        </label>
                        <p className="text-xs text-surface-500 mb-3">
                            Tell us about your project. What does it do? What problems does it solve?
                        </p>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your project in detail..."
                        />
                        <p className="text-xs text-surface-500 mt-1">
                            {description.replace(/<[^>]*>/g, '').length} characters (min 50)
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Tech Stack
                        </label>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={techInput}
                                onChange={(e) => setTechInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
                                placeholder="React, Node.js, PostgreSQL..."
                                className="flex-1 px-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                                type="button"
                                onClick={addTech}
                                className="px-4 py-2 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        {techStack.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {techStack.map((tech) => (
                                    <span
                                        key={tech}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-full text-sm"
                                    >
                                        {tech}
                                        <button onClick={() => removeTech(tech)} className="hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between">
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-2.5 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg font-medium transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={!canProceedStep2}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Media & Tags */}
            {step === 3 && (
                <div className="space-y-6">
                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Thumbnail
                        </label>
                        <p className="text-xs text-surface-500 mb-3">
                            Featured image for your project (recommended: 1200x630)
                        </p>
                        <div
                            {...thumbnailDropzone.getRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                                ${thumbnailDropzone.isDragActive
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-300 dark:border-surface-600 hover:border-surface-400'
                                }
                            `}
                        >
                            <input {...thumbnailDropzone.getInputProps()} />
                            {isUploadingThumbnail ? (
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600" />
                            ) : thumbnailUrl ? (
                                <div className="relative inline-block">
                                    <img
                                        src={thumbnailUrl}
                                        alt="Thumbnail"
                                        className="max-h-48 rounded-lg mx-auto"
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setThumbnailUrl(null);
                                        }}
                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 mx-auto text-surface-400 mb-2" />
                                    <p className="text-surface-600 dark:text-surface-400">
                                        Drop image here or click to upload
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Screenshots */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Screenshots
                        </label>
                        <p className="text-xs text-surface-500 mb-3">
                            Add up to 5 screenshots to showcase your project
                        </p>
                        <div
                            {...imagesDropzone.getRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors mb-4
                                ${imagesDropzone.isDragActive
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-300 dark:border-surface-600 hover:border-surface-400'
                                }
                            `}
                        >
                            <input {...imagesDropzone.getInputProps()} />
                            {isUploadingImages ? (
                                <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary-600" />
                            ) : (
                                <p className="text-sm text-surface-600 dark:text-surface-400">
                                    Drop images here or click to upload
                                </p>
                            )}
                        </div>
                        {imageUrls.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                {imageUrls.map((img, index) => (
                                    <div key={index} className="relative aspect-video rounded-lg overflow-hidden group">
                                        <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Tags
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => {
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`
                                            px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                                            ${isSelected
                                                ? 'text-white'
                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:opacity-80'
                                            }
                                        `}
                                        style={isSelected ? { backgroundColor: tag.color } : undefined}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-300">
                            <p className="font-medium">Review Process</p>
                            <p className="mt-1 text-blue-700 dark:text-blue-400">
                                Your submission will be reviewed by our team before it appears on the showcase.
                                This usually takes 24-48 hours.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <button
                            onClick={() => setStep(2)}
                            className="px-6 py-2.5 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg font-medium transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Submit for Review
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
