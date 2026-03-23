interface BackupResult {
    success: boolean;
    filename?: string;
    s3Key?: string;
    size?: number;
    duration?: number;
    error?: string;
}
/**
 * Main backup function - creates dump, compresses, uploads to S3, cleans up
 */
export declare function performBackup(): Promise<BackupResult>;
/**
 * List recent backups from S3
 */
export declare function listBackups(): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
}>>;
/**
 * Generate a pre-signed download URL for a backup file
 * URL expires after 15 minutes for security
 */
export declare function getBackupDownloadUrl(filename: string): Promise<string>;
export {};
//# sourceMappingURL=backup.d.ts.map