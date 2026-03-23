import { supabase } from './supabase';
import { cached, cacheInvalidate } from '@/lib/cache';

export interface Asset {
    id: string;
    filename: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    asset_type: 'image' | 'video' | 'document' | 'other';
    uploaded_by: string;
    post_id?: string;
    message_id?: string;
    feature_request_id?: string;
    created_at: string;
}

export type AssetInsert = Omit<Asset, 'id' | 'created_at'>;

/**
 * Save an asset reference to the database
 */
export async function createAsset(asset: AssetInsert): Promise<Asset> {
    const { data, error } = await supabase
        .from('assets')
        .insert(asset as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating asset:', error);
        throw error;
    }

    return data as Asset;
}

/**
 * Link assets to a post
 */
export async function linkAssetsToPost(post_id: string, asset_ids: string[]): Promise<void> {
    if (asset_ids.length === 0) return;

    const { error } = await supabase
        .from('assets')
        .update({ post_id } as never)
        .in('id', asset_ids)
        .select();

    if (error) {
        console.error('Error linking assets to post:', error);
        throw error;
    }

    cacheInvalidate(`assets:post:${post_id}`);
}

/**
 * Get assets for a post
 */
export async function getPostAssets(post_id: string): Promise<Asset[]> {
    const cacheKey = `assets:post:${post_id}`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('assets')
            .select('*')
            .eq('post_id', post_id);

        if (error) {
            console.error('Error fetching post assets:', error);
            return [];
        }

        return data as Asset[];
    }, 300_000); // 5 minutes - assets don't change often
}

/**
 * Link assets to a feature request
 */
export async function linkAssetsToFeatureRequest(feature_request_id: string, asset_ids: string[]): Promise<void> {
    if (asset_ids.length === 0) return;

    const { error } = await supabase
        .from('assets')
        .update({ feature_request_id } as never)
        .in('id', asset_ids)
        .select();

    if (error) {
        console.error('Error linking assets to feature request:', error);
        throw error;
    }

    cacheInvalidate(`assets:feature-request:${feature_request_id}`);
}

/**
 * Get assets for a feature request
 */
export async function getFeatureRequestAssets(feature_request_id: string): Promise<Asset[]> {
    const cacheKey = `assets:feature-request:${feature_request_id}`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('assets')
            .select('*')
            .eq('feature_request_id', feature_request_id);

        if (error) {
            console.error('Error fetching feature request assets:', error);
            return [];
        }

        return data as Asset[];
    }, 300_000);
}

/**
 * Delete an asset (database record)
 */
export async function deleteAssetRecord(id: string): Promise<void> {
    const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting asset record:', error);
        throw error;
    }
}
