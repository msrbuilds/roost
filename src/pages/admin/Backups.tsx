import { useState, useEffect, useCallback } from 'react';
import { backupService, BackupInfo, BackupResult } from '@/services/backup';
import {
    RefreshCw,
    Database,
    HardDrive,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Play,
    FileArchive,
    Download,
} from 'lucide-react';

export default function AdminBackups() {
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
    const [backupResult, setBackupResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [lastBackupDetails, setLastBackupDetails] = useState<BackupResult | null>(null);

    const fetchBackups = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await backupService.listBackups();
            setBackups(data.backups);
        } catch (error) {
            console.error('Error fetching backups:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);

    const handleTriggerBackup = async () => {
        try {
            setIsBackingUp(true);
            setBackupResult(null);
            setLastBackupDetails(null);

            const result = await backupService.triggerBackup();

            if (result.success) {
                setBackupResult({
                    type: 'success',
                    message: `Backup completed successfully in ${result.duration?.toFixed(1)}s`,
                });
                setLastBackupDetails(result);
                await fetchBackups();
            } else {
                setBackupResult({
                    type: 'error',
                    message: result.error || 'Backup failed',
                });
            }
        } catch (error) {
            setBackupResult({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to trigger backup',
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTimeSince = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    const handleDownload = async (filename: string) => {
        try {
            setDownloadingFile(filename);
            await backupService.downloadBackup(filename);
        } catch (error) {
            console.error('Download error:', error);
            setBackupResult({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to download backup',
            });
        } finally {
            setDownloadingFile(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    const latestBackup = backups[0];
    const totalSize = backups.reduce((sum, b) => sum + parseFloat(b.sizeMB), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Database Backups</h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-1">
                        Manage database backups stored in S3
                    </p>
                </div>
                <button
                    onClick={fetchBackups}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-surface-700 dark:text-surface-300 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Backup Result Message */}
            {backupResult && (
                <div
                    className={`p-4 rounded-lg flex items-center gap-3 ${
                        backupResult.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}
                >
                    {backupResult.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-medium">{backupResult.message}</p>
                        {lastBackupDetails && (
                            <p className="text-sm mt-1 opacity-80">
                                File: {lastBackupDetails.filename} ({((lastBackupDetails.size || 0) / (1024 * 1024)).toFixed(2)} MB)
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{backups.length}</p>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Total Backups</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <HardDrive className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                                {totalSize.toFixed(1)} MB
                            </p>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Total Storage Used</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                                {latestBackup ? getTimeSince(latestBackup.createdAt) : 'Never'}
                            </p>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Last Backup</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trigger Backup */}
            <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Create Backup</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <button
                        onClick={handleTriggerBackup}
                        disabled={isBackingUp}
                        className="flex min-w-[300px] items-center justify-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
                    >
                        {isBackingUp ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Creating Backup...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Create Backup Now
                            </>
                        )}
                    </button>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                        Creates a compressed SQL dump of the database and uploads it to S3.
                        This may take a few minutes depending on database size.
                    </p>
                </div>

                {/* Auto-backup info */}
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-300">
                            <p className="font-medium">Automatic Backups</p>
                            <p className="mt-1 opacity-80">
                                Backups are automatically created before each deployment. The system keeps the last 30 backups.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backup List */}
            <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Backup History</h2>

                {backups.length === 0 ? (
                    <div className="text-center py-12">
                        <FileArchive className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
                        <p className="text-surface-500 dark:text-surface-400">No backups found</p>
                        <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
                            Create your first backup using the button above
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-200 dark:border-surface-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        Filename
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        Size
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        Created
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        Age
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((backup, index) => (
                                    <tr
                                        key={backup.filename}
                                        className={`border-b border-surface-100 dark:border-surface-800 ${
                                            index === 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                                        }`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <FileArchive className="w-4 h-4 text-surface-400" />
                                                <code className="text-sm text-surface-700 dark:text-surface-300 font-mono">
                                                    {backup.filename}
                                                </code>
                                                {index === 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                        Latest
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-surface-600 dark:text-surface-400">
                                                {backup.sizeMB} MB
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-surface-600 dark:text-surface-400">
                                                {formatDate(backup.createdAt)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-surface-500 dark:text-surface-500">
                                                {getTimeSince(backup.createdAt)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleDownload(backup.filename)}
                                                disabled={downloadingFile === backup.filename}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                title="Download backup"
                                            >
                                                {downloadingFile === backup.filename ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                                Download
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
