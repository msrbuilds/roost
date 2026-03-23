import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { uploadAvatar } from '@/services/s3';

interface AvatarUploadProps {
    currentUrl?: string | null;
    displayName?: string;
    userId: string;
    onUpload: (url: string) => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl',
    xl: 'w-32 h-32 text-4xl',
};

export default function AvatarUpload({
    currentUrl,
    displayName,
    userId,
    onUpload,
    size = 'lg',
}: AvatarUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setError(null);
        setIsUploading(true);

        // Create preview
        const preview = URL.createObjectURL(file);
        setPreviewUrl(preview);

        try {
            const result = await uploadAvatar(file, userId);
            onUpload(result.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            setPreviewUrl(null);
        } finally {
            setIsUploading(false);
            // Clean up preview URL
            if (preview) URL.revokeObjectURL(preview);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const displayUrl = previewUrl || currentUrl;
    const initial = displayName?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative group">
                {/* Avatar */}
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={isUploading}
                    className={`
            ${sizeClasses[size]} rounded-full overflow-hidden
            bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold
            flex items-center justify-center
            border-4 border-white dark:border-surface-800 shadow-lg dark:shadow-none
            transition-all duration-200
            hover:ring-4 hover:ring-primary-100 dark:hover:ring-primary-900/50
            disabled:cursor-not-allowed
            relative
          `}
                >
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt={displayName || 'Avatar'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span>{initial}</span>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {isUploading ? (
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                            <Camera className="w-6 h-6 text-white" />
                        )}
                    </div>
                </button>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-1 text-sm text-error">
                    <X className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* Helper text */}
            <p className="text-xs text-surface-400 dark:text-surface-500">
                Click to upload • Max 5MB
            </p>
        </div>
    );
}
