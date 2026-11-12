import { useEffect, useState } from 'react';
import { getSignedDownloadUrl } from '@/services/s3';

export function useAssetUrl(source?: string | null) {
    const [url, setUrl] = useState(source?.startsWith('private:') ? '' : source || '');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let blobUrl = '';
        setError(null);
        if (!source) {
            setUrl('');
            return () => { active = false; };
        }
        if (!source.startsWith('private:')) {
            setUrl(source);
            return () => { active = false; };
        }
        setUrl('');
        getSignedDownloadUrl(source).then((resolved) => {
            if (!active) {
                URL.revokeObjectURL(resolved);
                return;
            }
            blobUrl = resolved;
            setUrl(resolved);
        }).catch((reason) => {
            if (active) setError(reason instanceof Error ? reason.message : 'File access denied');
        });
        return () => {
            active = false;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [source]);

    return { url, error, isLoading: Boolean(source?.startsWith('private:') && !url && !error) };
}
