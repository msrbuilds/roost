import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Link as LinkIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Category } from '@/types';
import { createPost, updatePost, getCategories, uploadImage, createAsset, linkAssetsToPost, getPostAssets, deleteAssetRecord, deleteFile } from '@/services';
import { useAuth } from '@/contexts/AuthContext';

const RichTextEditor = lazy(() => import('./RichTextEditor'));
import { PostWithDetails } from '@/services/post';
import { Asset } from '@/services/asset';

interface CreatePostModalProps {
    isOpen: boolean;
    groupId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
    editingPost?: PostWithDetails | null;
}

export default function CreatePostModal({
    isOpen,
    groupId,
    onClose,
    onSuccess,
    editingPost = null,
}: CreatePostModalProps) {
    const { user, profile } = useAuth();

    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorKey, setEditorKey] = useState(0);

    // Media state
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    // Fetch categories
    useEffect(() => {
        if (isOpen) {
            getCategories(groupId || undefined).then(setCategories);
        }
    }, [isOpen, groupId]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // Increment editor key to force remount
            setEditorKey((prev) => prev + 1);

            // Initialize from editingPost if present
            if (editingPost) {
                setTitle(editingPost.title || '');
                setContent(editingPost.content || '');
                setCategoryId(editingPost.category_id);
            } else {
                // Clear form for new post
                setTitle('');
                setContent('');
                setCategoryId(null);
                setAssets([]);
            }
        } else {
            // Reset form when closing
            setTitle('');
            setContent('');
            setCategoryId(null);
            setAssets([]);
            setError(null);
        }
    }, [isOpen, editingPost]);

    // Fetch assets if editing
    useEffect(() => {
        if (isOpen && editingPost) {
            getPostAssets(editingPost.id).then((fetchedAssets) => {
                setAssets(fetchedAssets);
            });
        }
    }, [isOpen, editingPost]);

    // Handle multiple file uploads
    const handleFilesUpload = useCallback(async (files: File[]) => {
        if (!user || files.length === 0) return;

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        const totalFiles = files.length;
        let completedFiles = 0;

        try {
            for (const file of files) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    continue;
                }

                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    setError(`File ${file.name} is too large. Maximum size is 10MB.`);
                    continue;
                }

                // 1. Upload to S3
                const uploadResult = await uploadImage(file);

                // 2. Save to database
                const assetData = await createAsset({
                    filename: uploadResult.fileName,
                    file_url: uploadResult.url,
                    file_size: uploadResult.fileSize,
                    mime_type: uploadResult.mimeType,
                    asset_type: 'image',
                    uploaded_by: user.id,
                });

                setAssets((prev) => [...prev, assetData]);

                completedFiles++;
                setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload images');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [user]);

    // Dropzone configuration
    const onDrop = useCallback((acceptedFiles: File[]) => {
        handleFilesUpload(acceptedFiles);
    }, [handleFilesUpload]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
        },
        multiple: true,
        noClick: true, // We'll use the button to open
        noKeyboard: true,
    });

    const handleRemoveAsset = async (asset: Asset) => {
        try {
            setAssets((prev) => prev.filter((a) => a.id !== asset.id));

            // Extract key from URL
            const urlParts = asset.file_url.split('/');
            const key = urlParts.slice(3).join('/');

            await deleteFile(key);
            await deleteAssetRecord(asset.id);
        } catch (err) {
            console.error('Failed to remove asset:', err);
        }
    };

    const handleSubmit = async () => {
        const strippedContent = content.replace(/<[^>]*>/g, '').trim();
        if (!user || (!strippedContent && !content.includes('<img') && assets.length === 0)) return;

        setIsSubmitting(true);
        setError(null);

        try {
            let resultPost: any;
            if (editingPost) {
                resultPost = await updatePost(editingPost.id, {
                    content: content.trim(),
                    title: title.trim() || null,
                    category_id: categoryId,
                });
            } else {
                resultPost = await createPost({
                    content: content.trim(),
                    title: title.trim() || null,
                    author_id: user.id,
                    group_id: groupId ?? null,
                    category_id: categoryId,
                });
            }

            // Link assets to the post
            if (assets.length > 0) {
                await linkAssetsToPost(resultPost.id, assets.map(a => a.id));
                await updatePost(resultPost.id, {});
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save post');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-surface-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        {editingPost ? 'Edit Post' : 'Create Post'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1" {...getRootProps()}>
                    <input {...getInputProps()} />

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium ${profile?.avatar_url ? 'hidden' : ''}`}>
                            {profile?.display_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="font-medium text-surface-900 dark:text-surface-50">{profile?.display_name}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">@{profile?.username}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add a title (optional)"
                            className="w-full px-4 py-3 text-lg font-medium text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <Suspense fallback={<div className="h-[200px] animate-pulse bg-surface-50 dark:bg-surface-800 rounded-xl" />}>
                            <RichTextEditor
                                key={editorKey}
                                value={content}
                                onChange={setContent}
                                placeholder="What would you like to share with the community?"
                                initialValue={editingPost?.content || ''}
                            />
                        </Suspense>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div
                        onClick={open}
                        className={`
                            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                            transition-all duration-200
                            ${isDragActive
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-surface-300 dark:border-surface-600 hover:border-primary-400 hover:bg-surface-50 dark:hover:bg-surface-800'
                            }
                        `}
                    >
                        <div className="flex flex-col items-center gap-2">
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                                    <p className="text-sm text-surface-600 dark:text-surface-400">
                                        Uploading... {uploadProgress}%
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Upload className={`w-8 h-8 ${isDragActive ? 'text-primary-500' : 'text-surface-400 dark:text-surface-500'}`} />
                                    <div>
                                        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                            {isDragActive ? 'Drop images here' : 'Drag & drop images, or click to select'}
                                        </p>
                                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                                            PNG, JPG, GIF, WebP up to 10MB each
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Image Preview Gallery */}
                    {assets.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {assets.map((asset) => (
                                <div key={asset.id} className="relative aspect-video rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 group">
                                    <img
                                        src={asset.file_url}
                                        alt={asset.filename}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveAsset(asset);
                                        }}
                                        className="absolute top-1 right-1 p-1.5 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {categories.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-surface-500 dark:text-surface-400">Category:</span>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                                    className={`
                                        px-3 py-1 rounded-full text-xs font-medium
                                        transition-all duration-200
                                        ${categoryId === cat.id
                                            ? 'text-white'
                                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                                        }
                                    `}
                                    style={{
                                        backgroundColor: categoryId === cat.id ? (cat.color ?? undefined) : undefined,
                                    }}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={open}
                            disabled={isUploading}
                            className="p-2 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-full transition-colors text-surface-500 dark:text-surface-400 disabled:opacity-50"
                            title="Add images"
                        >
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <ImageIcon className="w-5 h-5" />
                            )}
                        </button>
                        <button
                            className="p-2 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-full transition-colors text-surface-500 dark:text-surface-400"
                            title="Add link"
                        >
                            <LinkIcon className="w-5 h-5" />
                        </button>
                        {assets.length > 0 && (
                            <span className="text-xs text-surface-500 dark:text-surface-400 ml-2">
                                {assets.length} image{assets.length !== 1 ? 's' : ''} attached
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || isUploading || (!content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img') && assets.length === 0)}
                            className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                editingPost ? 'Save Changes' : 'Post'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
