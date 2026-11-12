/**
 * Activation API Routes
 * Handles activation request status updates with email notifications
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createUserScopedClient, supabaseAdmin } from '../lib/supabase.js';
import { emailService } from '../services/email.js';
import {
  getCachedActivationStats,
  getCachedUserProfile,
  invalidateActivationStats,
  type ActivationStats,
} from '../services/cache.js';

const router = Router();

// Validation schemas
const updateStatusSchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
    admin_notes: z.string().optional(),
});

const productSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().max(5000).nullable().optional(),
    product_type: z.enum(['plugin', 'theme', 'other']),
    monthly_limit: z.number().int().min(1).max(100),
    is_active: z.boolean().optional(),
    instructions: z.string().max(10000).nullable().optional(),
    icon_url: z.string().url().nullable().optional(),
    license_key: z.string().max(5000).nullable().optional(),
    file_url: z.string().max(2000).nullable().optional(),
    file_name: z.string().max(255).nullable().optional(),
});

async function requireProductAdmin(req: Request, res: Response, allowModerator = false) {
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
    if (error || !data.user) { res.status(401).json({ error: 'Invalid token' }); return null; }
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role, is_banned').eq('id', data.user.id).single();
    const allowedRoles = allowModerator ? ['moderator', 'admin', 'superadmin'] : ['admin', 'superadmin'];
    if (profileError || !profile || profile.is_banned || !allowedRoles.includes(profile.role)) {
        res.status(403).json({ error: 'Administrator access required' }); return null;
    }
    return data.user;
}

router.get('/products', async (req, res) => {
    if (!await requireProductAdmin(req, res, true)) return;
    const [{ data: products, error }, { data: secrets, error: secretError }] = await Promise.all([
        supabaseAdmin.from('activation_products').select('*').order('name'),
        supabaseAdmin.from('activation_product_secrets').select('product_id, license_key'),
    ]);
    if (error || secretError) return res.status(500).json({ error: error?.message || secretError?.message });
    const keys = new Map((secrets || []).map((item) => [item.product_id, item.license_key]));
    return res.json((products || []).map((product) => ({ ...product, license_key: keys.get(product.id) || null })));
});

router.post('/products', async (req, res) => {
    if (!await requireProductAdmin(req, res)) return;
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid product', details: parsed.error.issues });
    const { license_key, ...product } = parsed.data;
    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await supabaseAdmin.from('activation_products').insert({ ...product, slug, is_active: product.is_active ?? true }).select().single();
    if (error || !data) return res.status(500).json({ error: error?.message || 'Product creation failed' });
    if (license_key) {
        const { error: secretError } = await supabaseAdmin.from('activation_product_secrets').upsert({ product_id: data.id, license_key });
        if (secretError) { await supabaseAdmin.from('activation_products').delete().eq('id', data.id); return res.status(500).json({ error: 'Product secret could not be stored' }); }
    }
    return res.status(201).json({ ...data, license_key: license_key || null });
});

router.patch('/products/:productId', async (req, res) => {
    if (!await requireProductAdmin(req, res)) return;
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid product', details: parsed.error.issues });
    const { license_key, ...updates } = parsed.data;
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.name) updateData.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await supabaseAdmin.from('activation_products').update(updateData).eq('id', req.params.productId).select().single();
    if (error || !data) return res.status(500).json({ error: error?.message || 'Product update failed' });
    if (license_key !== undefined) {
        const { error: secretError } = await supabaseAdmin.from('activation_product_secrets').upsert({ product_id: data.id, license_key });
        if (secretError) return res.status(500).json({ error: 'Product updated but its secret could not be stored' });
    }
    return res.json({ ...data, license_key: license_key ?? null });
});

router.delete('/products/:productId', async (req, res) => {
    if (!await requireProductAdmin(req, res)) return;
    const { error } = await supabaseAdmin.from('activation_products').delete().eq('id', req.params.productId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
});

/**
 * POST /api/activations/:id/status
 * Update activation request status and send email notification
 */
router.post('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.substring(7);

        // Verify the user is authenticated and get their profile
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user is admin or moderator (with cache)
        const profile = await getCachedUserProfile(user.id, async () => {
            const { data, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id, role, is_banned')
                .eq('id', user.id)
                .single();
            if (profileError) return null;
            return data;
        });

        if (!profile) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (!['admin', 'superadmin', 'moderator'].includes(profile.role || '')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        if (profile.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }

        // Validate request body
        const parsed = updateStatusSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.issues,
            });
        }

        const { status, admin_notes } = parsed.data;

        // Get the activation request with user and product details
        const { data: request, error: requestError } = await supabaseAdmin
            .from('activation_requests')
            .select(`
                *,
                user:profiles!activation_requests_user_id_fkey(id, display_name, username),
                product:activation_products(id, name)
            `)
            .eq('id', id)
            .single();

        if (requestError || !request) {
            return res.status(404).json({ error: 'Activation request not found' });
        }

        // Run the status transition, usage update, and in-app notification in
        // the database using the verified moderator/admin as auth.uid().
        const userClient = createUserScopedClient(token);
        const { error: updateError } = await userClient.rpc('process_activation_request', {
            p_request_id: id,
            p_processor_id: user.id,
            p_status: status,
            p_admin_notes: admin_notes || null,
        });

        if (updateError) {
            console.error('Error processing activation request:', updateError);
            return res.status(500).json({ error: 'Failed to update request' });
        }

        // Get user email for notification
        const { data: userData, error: userError } = await supabaseAdmin
            .auth.admin.getUserById(request.user_id);

        if (!userError && userData?.user?.email) {
            // Send email notification
            await emailService.sendActivationStatusEmail({
                email: userData.user.email,
                name: request.user?.display_name || request.user?.username || 'there',
                productName: request.product?.name || 'Product',
                status,
                websiteUrl: request.website_url,
                adminNotes: admin_notes,
            });
        }

        // Invalidate activation stats cache after status update
        await invalidateActivationStats();

        return res.json({
            success: true,
            message: `Request status updated to ${status}`,
        });
    } catch (error) {
        console.error('Error processing activation status update:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/activations/stats
 * Get activation statistics (cached)
 */
router.get('/stats', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.substring(7);

        // Verify the user is authenticated
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user is admin or moderator (with cache)
        const profile = await getCachedUserProfile(user.id, async () => {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('id, role, is_banned')
                .eq('id', user.id)
                .single();
            return data;
        });

        if (!['admin', 'superadmin', 'moderator'].includes(profile?.role || '')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        if (profile?.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }

        // Get stats (with cache)
        const stats = await getCachedActivationStats(async (): Promise<ActivationStats> => {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const [
                totalProducts,
                totalRequests,
                pendingRequests,
                inProgressRequests,
                completedThisMonth,
                rejectedThisMonth,
            ] = await Promise.all([
                supabaseAdmin.from('activation_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }),
                supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
                supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('processed_at', monthStart),
                supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('processed_at', monthStart),
            ]);

            return {
                total_products: totalProducts.count || 0,
                total_requests: totalRequests.count || 0,
                pending_requests: pendingRequests.count || 0,
                in_progress_requests: inProgressRequests.count || 0,
                completed_this_month: completedThisMonth.count || 0,
                rejected_this_month: rejectedThisMonth.count || 0,
            };
        });

        return res.json(stats);
    } catch (error) {
        console.error('Error fetching activation stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export const activationApiRouter = router;
