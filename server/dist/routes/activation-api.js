"use strict";
/**
 * Activation API Routes
 * Handles activation request status updates with email notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activationApiRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const supabase_js_1 = require("../lib/supabase.js");
const email_js_1 = require("../services/email.js");
const cache_js_1 = require("../services/cache.js");
const router = (0, express_1.Router)();
// Validation schemas
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'rejected']),
    admin_notes: zod_1.z.string().optional(),
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
        const { data: { user }, error: authError } = await supabase_js_1.supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Check if user is admin or moderator (with cache)
        const profile = await (0, cache_js_1.getCachedUserProfile)(user.id, async () => {
            const { data, error: profileError } = await supabase_js_1.supabaseAdmin
                .from('profiles')
                .select('id, role, is_banned')
                .eq('id', user.id)
                .single();
            if (profileError)
                return null;
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
        const { data: request, error: requestError } = await supabase_js_1.supabaseAdmin
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
        // Update the request status
        const { error: updateError } = await supabase_js_1.supabaseAdmin
            .from('activation_requests')
            .update({
            status,
            admin_notes: admin_notes || null,
            processed_by: user.id,
            processed_at: new Date().toISOString(),
        })
            .eq('id', id);
        if (updateError) {
            console.error('Error updating activation request:', updateError);
            return res.status(500).json({ error: 'Failed to update request' });
        }
        // If completed, update usage counter
        if (status === 'completed') {
            // Use UTC date to match PostgreSQL's date_trunc('month', NOW())
            const now = new Date();
            const monthYearStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
            // Check if usage record exists
            const { data: existingUsage } = await supabase_js_1.supabaseAdmin
                .from('activation_usage')
                .select('id, usage_count')
                .eq('user_id', request.user_id)
                .eq('product_id', request.product_id)
                .eq('month_year', monthYearStr)
                .single();
            if (existingUsage) {
                // Increment existing usage count
                const { error: updateError } = await supabase_js_1.supabaseAdmin
                    .from('activation_usage')
                    .update({ usage_count: existingUsage.usage_count + 1 })
                    .eq('id', existingUsage.id);
                if (updateError) {
                    console.error('Error incrementing usage count:', updateError);
                }
            }
            else {
                // Insert new usage record with count of 1
                const { error: insertError } = await supabase_js_1.supabaseAdmin
                    .from('activation_usage')
                    .insert({
                    user_id: request.user_id,
                    product_id: request.product_id,
                    month_year: monthYearStr,
                    usage_count: 1,
                });
                if (insertError) {
                    console.error('Error inserting usage count:', insertError);
                }
            }
        }
        // Create in-app notification
        const notificationTitles = {
            pending: 'Activation Request Received',
            in_progress: 'Activation In Progress',
            completed: 'Activation Completed',
            rejected: 'Activation Request Update',
        };
        const notificationMessages = {
            pending: `Your ${request.product?.name} activation request has been received.`,
            in_progress: `Your ${request.product?.name} activation is being processed.`,
            completed: `Your ${request.product?.name} has been successfully activated!`,
            rejected: `Your ${request.product?.name} activation request has been reviewed.`,
        };
        await supabase_js_1.supabaseAdmin.from('notifications').insert({
            user_id: request.user_id,
            type: 'new_message',
            title: notificationTitles[status],
            message: notificationMessages[status],
            link: '/activations',
        });
        // Get user email for notification
        const { data: userData, error: userError } = await supabase_js_1.supabaseAdmin
            .auth.admin.getUserById(request.user_id);
        if (!userError && userData?.user?.email) {
            // Send email notification
            await email_js_1.emailService.sendActivationStatusEmail({
                email: userData.user.email,
                name: request.user?.display_name || request.user?.username || 'there',
                productName: request.product?.name || 'Product',
                status,
                websiteUrl: request.website_url,
                adminNotes: admin_notes,
            });
        }
        // Invalidate activation stats cache after status update
        await (0, cache_js_1.invalidateActivationStats)();
        return res.json({
            success: true,
            message: `Request status updated to ${status}`,
        });
    }
    catch (error) {
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
        const { data: { user }, error: authError } = await supabase_js_1.supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Check if user is admin or moderator (with cache)
        const profile = await (0, cache_js_1.getCachedUserProfile)(user.id, async () => {
            const { data } = await supabase_js_1.supabaseAdmin
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
        const stats = await (0, cache_js_1.getCachedActivationStats)(async () => {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const [totalProducts, totalRequests, pendingRequests, inProgressRequests, completedThisMonth, rejectedThisMonth,] = await Promise.all([
                supabase_js_1.supabaseAdmin.from('activation_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase_js_1.supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }),
                supabase_js_1.supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase_js_1.supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
                supabase_js_1.supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('processed_at', monthStart),
                supabase_js_1.supabaseAdmin.from('activation_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('processed_at', monthStart),
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
    }
    catch (error) {
        console.error('Error fetching activation stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.activationApiRouter = router;
//# sourceMappingURL=activation-api.js.map