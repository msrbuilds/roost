import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import { X, Upload, File, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/s3';
import { createAsset } from '@/services/asset';
import { linkAssetToGroup } from '@/services/group';
import { getAssetType } from '@/services/s3';

interface UploadAssetsModalProps {
    isOpen: boolean;
    groupId: string;
    moduleId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

interface FileWithPreview {
    file: File;
    name: string;
    size: number;
    type: string;
}

export default function UploadAssetsModal({
    isOpen,
    groupId,
    moduleId,
    onClose,
    onSuccess,
}: UploadAssetsModalProps) {
    const { user } = useAuth();
    const [files, setFiles] = useState<FileWithPreview[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const onDrop = (acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map((file) => ({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
        setError(null);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/zip': ['.zip'],
            'application/x-rar-compressed': ['.rar'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'text/markdown': ['.md'],
            'text/x-markdown': ['.md'],
        },
        maxSize: 100 * 1024 * 1024, // 100MB
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleUpload = async () => {
        if (!user || files.length === 0) return;

        setIsUploading(true);
        setError(null);

        try {
            const totalFiles = files.length;

            for (let i = 0; i < files.length; i++) {
                const fileItem = files[i];

                // Update progress
                setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));

                // Upload to S3
                const uploadResult = await uploadFile(fileItem.file, `groups/${groupId}/documents`);

                // Create asset record in database
                const asset = await createAsset({
                    filename: uploadResult.fileName,
                    file_url: uploadResult.url,
                    file_size: uploadResult.fileSize,
                    mime_type: uploadResult.mimeType,
                    asset_type: getAssetType(uploadResult.mimeType),
                    uploaded_by: user.id,
                });

                // Link asset to group
                await linkAssetToGroup(groupId, asset.id, user.id, moduleId);
            }

            onSuccess();
        } catch (err) {
            console.error('Error uploading files:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload files');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-surface-100 dark:border-surface-700">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">Upload Course Materials</h2>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`
                            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                            ${isDragActive
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-surface-50 dark:hover:bg-surface-800'
                            }
                        `}
                    >
                        <input {...getInputProps()} disabled={isUploading} />
                        <Upload className="w-12 h-12 mx-auto text-surface-400 dark:text-surface-500 mb-3" />
                        <p className="text-base font-medium text-surface-900 dark:text-surface-50 mb-1">
                            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                        </p>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                            or click to browse your computer
                        </p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">
                            Supported: PDF, DOC, DOCX, MD, ZIP, RAR, Images (up to 100MB)
                        </p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                Files to upload ({files.length})
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {files.map((fileItem, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <File className="w-5 h-5 text-surface-500 dark:text-surface-400 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                                                    {fileItem.name}
                                                </p>
                                                <p className="text-xs text-surface-500 dark:text-surface-400">
                                                    {formatFileSize(fileItem.size)}
                                                </p>
                                            </div>
                                        </div>
                                        {!isUploading && (
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="p-1.5 text-surface-500 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Progress */}
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-surface-700 dark:text-surface-300">Uploading files...</span>
                                <span className="font-medium text-primary-600 dark:text-primary-400">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2">
                                <div
                                    className="bg-primary-600 dark:bg-primary-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-surface-100 dark:border-surface-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={isUploading || files.length === 0}
                        className="flex-1 px-4 py-2.5 bg-primary-600 dark:bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isUploading ? 'Uploading...' : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
