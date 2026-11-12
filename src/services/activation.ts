/**
 * Activation Service
 * Handles product activation requests for premium products like Elementor, Bricks Builder, themes, etc.
 * Users submit requests with website credentials, admins/moderators process them.
 */

import { supabase } from './supabase';
import type {
    ActivationProduct,
    ActivationRequest,
    ActivationRequestStatus,
    Profile,
} from '../types/database';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductWithUsage extends ActivationProduct {
    remaining_activations: number;
    has_active_request: boolean;
}

export interface AdminActivationProduct extends ActivationProduct {
    license_key: string | null;
}

export interface ActivationRequestWithDetails extends ActivationRequest {
    user?: Profile;
    product?: AdminActivationProduct;
    processor?: Profile;
}

export interface ActivationStats {
    total_products: number;
    total_requests: number;
    pending_requests: number;
    in_progress_requests: number;
    completed_this_month: number;
    rejected_this_month: number;
    total_users_with_activations: number;
}

export const PRODUCT_TYPES = [
    { value: 'plugin', label: 'Plugin' },
    { value: 'theme', label: 'Theme' },
    { value: 'other', label: 'Other' },
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number]['value'];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function adminProductRequest<T>(path = '', init?: RequestInit): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');
    const response = await fetch(`${API_URL}/api/activations/products${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            ...init?.headers,
        },
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Activation product request failed');
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

// =============================================================================
// USER FUNCTIONS
// =============================================================================

/**
 * Get all active products with user's remaining activations
 */
export async function getAvailableProducts(userId: string): Promise<ProductWithUsage[]> {
    // Get all active products
    const { data: products, error: productsError } = await supabase
        .from('activation_products')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (productsError) throw productsError;

    // For each product, get remaining activations and check for active request
    const productsWithUsage = await Promise.all(
        (products || []).map(async (product) => {
            // Get remaining activations using RPC
            const { data: remaining, error: remainingError } = await supabase
                .rpc('get_remaining_activations', {
                    p_user_id: userId,
                    p_product_id: product.id,
                });

            if (remainingError) {
                console.error('Error getting remaining activations:', remainingError);
            }

            // Check for active (pending/in_progress) request
            const { data: activeRequest, error: activeError } = await supabase
                .rpc('has_active_request', {
                    p_user_id: userId,
                    p_product_id: product.id,
                });

            if (activeError) {
                console.error('Error checking active request:', activeError);
            }

            return {
                ...product,
                remaining_activations: remaining ?? product.monthly_limit,
                has_active_request: activeRequest ?? false,
            };
        })
    );

    return productsWithUsage;
}

/**
 * Get user's activation request history
 */
export async function getUserActivations(userId: string): Promise<ActivationRequestWithDetails[]> {
    const { data, error } = await supabase
        .from('activation_requests')
        .select(`
            *,
            product:activation_products(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ActivationRequestWithDetails[];
}

/**
 * Request a product activation
 */
export async function requestActivation(
    userId: string,
    productId: string,
    websiteUrl: string,
    wpUsername: string,
    wpPassword: string,
    notes?: string
): Promise<string> {
    const { data, error } = await supabase.rpc('request_activation', {
        p_user_id: userId,
        p_product_id: productId,
        p_website_url: websiteUrl,
        p_wp_username: wpUsername,
        p_wp_password: wpPassword,
        p_notes: notes ?? undefined,
    });

    if (error) throw error;
    return data;
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Get all products (admin view - includes inactive)
 */
export async function getAdminProducts(): Promise<AdminActivationProduct[]> {
    return adminProductRequest<AdminActivationProduct[]>();
}

/**
 * Create a new product
 */
export async function createProduct(product: {
    name: string;
    description?: string;
    product_type: string;
    monthly_limit: number;
    instructions?: string;
    icon_url?: string;
    license_key?: string;
    file_url?: string;
    file_name?: string;
}): Promise<AdminActivationProduct> {
    return adminProductRequest<AdminActivationProduct>('', {
        method: 'POST',
        body: JSON.stringify({ ...product, is_active: true }),
    });
}

/**
 * Update a product
 */
export async function updateProduct(
    productId: string,
    updates: Partial<{
        name: string;
        description: string | null;
        product_type: string;
        monthly_limit: number;
        is_active: boolean;
        instructions: string | null;
        icon_url: string | null;
        license_key: string | null;
        file_url: string | null;
        file_name: string | null;
    }>
): Promise<AdminActivationProduct> {
    return adminProductRequest<AdminActivationProduct>(`/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

/**
 * Delete a product
 */
export async function deleteProduct(productId: string): Promise<void> {
    await adminProductRequest<void>(`/${productId}`, { method: 'DELETE' });
}

/**
 * Get activation requests with filtering and pagination (admin)
 */
export async function getActivationRequests(options?: {
    status?: ActivationRequestStatus | 'all';
    search?: string;
    page?: number;
    pageSize?: number;
}): Promise<{ requests: ActivationRequestWithDetails[]; total: number }> {
    const { status = 'all', search = '', page = 1, pageSize = 20 } = options || {};
    const offset = (page - 1) * pageSize;

    let query = supabase
        .from('activation_requests')
        .select(`
            *,
            user:profiles!activation_requests_user_id_fkey(id, username, display_name, avatar_url),
            product:activation_products(*),
            processor:profiles!activation_requests_processed_by_fkey(id, username, display_name, avatar_url)
        `, { count: 'exact' });

    // Status filter
    if (status !== 'all') {
        query = query.eq('status', status);
    }

    // Search filter (by website URL or user notes)
    if (search.trim()) {
        query = query.or(`website_url.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    // Pagination and ordering
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    const products = await getAdminProducts();
    const productMap = new Map(products.map((product) => [product.id, product]));
    const requests = (data || []).map((request: any) => ({
        ...request,
        product: request.product ? productMap.get(request.product.id) || request.product : undefined,
    })) as ActivationRequestWithDetails[];
    return {
        requests,
        total: count || 0,
    };
}

/**
 * Get a single activation request by ID (admin)
 */
export async function getActivationRequest(requestId: string): Promise<ActivationRequestWithDetails | null> {
    const { data, error } = await supabase
        .from('activation_requests')
        .select(`
            *,
            user:profiles!activation_requests_user_id_fkey(id, username, display_name, avatar_url),
            product:activation_products(*),
            processor:profiles!activation_requests_processed_by_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', requestId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data as ActivationRequestWithDetails;
}

/**
 * Process an activation request (admin/mod)
 */
export async function processActivationRequest(
    requestId: string,
    processorId: string,
    status: ActivationRequestStatus,
    adminNotes?: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc('process_activation_request', {
        p_request_id: requestId,
        p_processor_id: processorId,
        p_status: status,
        p_admin_notes: adminNotes ?? undefined,
    });

    if (error) throw error;
    return data;
}

/**
 * Get activation statistics for admin dashboard
 */
export async function getActivationStats(): Promise<ActivationStats> {
    const { data, error } = await supabase.rpc('get_activation_stats');

    if (error) throw error;
    return data as unknown as ActivationStats;
}

/**
 * Get activation stats using manual queries (fallback if RPC not available)
 */
export async function getActivationStatsManual(): Promise<ActivationStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
        totalProductsResult,
        totalRequestsResult,
        pendingResult,
        inProgressResult,
        completedResult,
        rejectedResult,
        uniqueUsersResult,
    ] = await Promise.all([
        supabase.from('activation_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('activation_requests').select('id', { count: 'exact', head: true }),
        supabase.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('processed_at', monthStart),
        supabase.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('processed_at', monthStart),
        supabase.from('activation_requests').select('user_id').eq('status', 'completed'),
    ]);

    // Count unique users
    const uniqueUsers = new Set((uniqueUsersResult.data || []).map(r => r.user_id)).size;

    return {
        total_products: totalProductsResult.count || 0,
        total_requests: totalRequestsResult.count || 0,
        pending_requests: pendingResult.count || 0,
        in_progress_requests: inProgressResult.count || 0,
        completed_this_month: completedResult.count || 0,
        rejected_this_month: rejectedResult.count || 0,
        total_users_with_activations: uniqueUsers,
    };
}
