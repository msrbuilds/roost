import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface BackupInfo {
    filename: string;
    sizeMB: string;
    createdAt: string;
}

export interface BackupResult {
    success: boolean;
    filename?: string;
    s3Key?: string;
    size?: number;
    duration?: number;
    error?: string;
    message?: string;
}

export interface BackupListResponse {
    count: number;
    backups: BackupInfo[];
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
    };
}

export const backupService = {
    /**
     * Trigger a manual database backup (admin only)
     */
    async triggerBackup(): Promise<BackupResult> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/backup/trigger`, {
            method: 'POST',
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to trigger backup');
        }

        return data;
    },

    /**
     * List recent backups (admin only)
     */
    async listBackups(): Promise<BackupListResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/backup/list`, {
            method: 'GET',
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to list backups');
        }

        return data;
    },

    /**
     * Get a download URL for a backup file (admin only)
     */
    async getDownloadUrl(filename: string): Promise<string> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/backup/download/${encodeURIComponent(filename)}`, {
            method: 'GET',
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to get download URL');
        }

        return data.downloadUrl;
    },

    /**
     * Download a backup file by opening the pre-signed URL
     */
    async downloadBackup(filename: string): Promise<void> {
        const downloadUrl = await this.getDownloadUrl(filename);
        window.open(downloadUrl, '_blank');
    },
};
