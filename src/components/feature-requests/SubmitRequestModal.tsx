import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Lightbulb, Bug, Sparkles, Upload, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import RichTextEditor from '@/components/feed/RichTextEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createFeatureRequest } from '@/services/feature-request';
import { uploadImage, createAsset, linkAssetsToFeatureRequest, deleteFile, deleteAssetRecord } from '@/services';
import type { Asset } from '@/services/asset';
import type { FeatureRequestType } from '@/types/database';

interface SubmitRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const REQUEST_TYPES: { value: FeatureRequestType; label: string; icon: typeof Lightbulb; description: string }[] = [
    { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, description: 'Suggest a new feature' },
    { value: 'bug_report', label: 'Bug Report', icon: Bug, description: 'Report something broken' },
    { value: 'improvement', label: 'Improvement', icon: Sparkles, description: 'Improve existing functionality' },
];

export default function SubmitRequestModal({ isOpen, onClose, onSuccess }: SubmitRequestModalProps) {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<FeatureRequestType>('feature_request');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Media state
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const canSubmit = title.trim().length >= 5 && description.replace(/<[^>]*>/g, '').trim().length >= 20;

    const handleFilesUpload = useCallback(async (files: File[]) => {
        if (!user || files.length === 0) return;

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        const totalFiles = files.length;
        let completedFiles = 0;

        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    continue;
                }

                if (file.size > 10 * 1024 * 1024) {
                    setError(`File ${file.name} is too large. Maximum size is 10MB.`);
                    continue;
                }

                const uploadResult = await uploadImage(file);

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

    const onDrop = useCallback((acceptedFiles: File[]) => {
        handleFilesUpload(acceptedFiles);
    }, [handleFilesUpload]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
        },
        multiple: true,
        noClick: true,
        noKeyboard: true,
    });

    const handleRemoveAsset = async (asset: Asset) => {
        try {
            setAssets((prev) => prev.filter((a) => a.id !== asset.id));

            const urlParts = asset.file_url.split('/');
            const key = urlParts.slice(3).join('/');

            await deleteFile(key);
            await deleteAssetRecord(asset.id);
        } catch (err) {
            console.error('Failed to remove asset:', err);
        }
    };

    const handleSubmit = async () => {
        if (!user || !canSubmit) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const request = await createFeatureRequest({
                title: title.trim(),
                description,
                type,
                author_id: user.id,
            });

            // Link assets to the feature request
            if (assets.length > 0) {
                await linkAssetsToFeatureRequest(request.id, assets.map(a => a.id));
            }

            // Reset form
            setTitle('');
            setDescription('');
            setType('feature_request');
            setAssets([]);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error submitting request:', err);
            setError('Failed to submit request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-surface-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                        Submit Request
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" {...getRootProps()}>
                    <input {...getInputProps()} />

                    {/* Type selector */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {REQUEST_TYPES.map((rt) => {
                                const Icon = rt.icon;
                                return (
                                    <button
                                        key={rt.value}
                                        type="button"
                                        onClick={() => setType(rt.value)}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors text-center ${
                                            type === rt.value
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 ${type === rt.value ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                                        <span className={`text-xs font-medium ${type === rt.value ? 'text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-400'}`}>
                                            {rt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief summary of your request..."
                            maxLength={255}
                            className="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        />
                        <p className="text-xs text-surface-400 mt-1">
                            {title.length}/255 characters (min 5)
                        </p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                            Description
                        </label>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your request in detail..."
                        />
                        <p className="text-xs text-surface-400 mt-1">
                            Min 20 characters of text
                        </p>
                    </div>

                    {/* Image Upload Zone */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                            Screenshots (optional)
                        </label>
                        <div
                            onClick={open}
                            className={`
                                border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
                                transition-all duration-200
                                ${isDragActive
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-surface-300 dark:border-surface-600 hover:border-primary-400 hover:bg-surface-50 dark:hover:bg-surface-800'
                                }
                            `}
                        >
                            <div className="flex flex-col items-center gap-1.5">
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                                        <p className="text-sm text-surface-600 dark:text-surface-400">
                                            Uploading... {uploadProgress}%
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className={`w-6 h-6 ${isDragActive ? 'text-primary-500' : 'text-surface-400 dark:text-surface-500'}`} />
                                        <p className="text-sm text-surface-600 dark:text-surface-400">
                                            {isDragActive ? 'Drop images here' : 'Drag & drop images, or click to select'}
                                        </p>
                                        <p className="text-xs text-surface-400 dark:text-surface-500">
                                            PNG, JPG, GIF, WebP up to 10MB each
                                        </p>
                                    </>
                                )}
                            </div>
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

                    {/* Error message */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-2">
                        {assets.length > 0 && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                                {assets.length} image{assets.length !== 1 ? 's' : ''} attached
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isSubmitting || isUploading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Request'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
