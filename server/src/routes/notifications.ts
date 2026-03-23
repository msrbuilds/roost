import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { emailService } from '../services/email.js';

const router = Router();

interface PendingNotification {
    notification_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    notification_type: string;
    title: string;
    message: string | null;
    link: string | null;
    created_at: string;
}

/**
 * Process pending notification emails
 * This endpoint should be called by a cron job or scheduler
 * POST /api/notifications/process-emails
 */
router.post('/process-emails', async (req: Request, res: Response) => {
    // Simple API key authentication for cron jobs
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.NOTIFICATIONS_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const batchSize = parseInt(req.query.batch_size as string) || 50;

        // Get pending notification emails using the database function
        const { data: pendingNotifications, error: fetchError } = await supabaseAdmin
            .rpc('get_pending_notification_emails', { batch_size: batchSize });

        if (fetchError) {
            console.error('Error fetching pending notifications:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch pending notifications' });
        }

        if (!pendingNotifications || pendingNotifications.length === 0) {
            return res.json({ processed: 0, message: 'No pending notifications' });
        }

        const results = {
            processed: 0,
            sent: 0,
            failed: 0,
            errors: [] as string[],
        };

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Process each notification
        for (const notification of pendingNotifications as PendingNotification[]) {
            results.processed++;

            try {
                const emailSent = await emailService.sendNotificationEmail({
                    to: notification.user_email,
                    userName: notification.user_name,
                    notificationType: notification.notification_type,
                    title: notification.title,
                    message: notification.message || undefined,
                    link: notification.link ? `${frontendUrl}${notification.link}` : undefined,
                });

                if (emailSent) {
                    // Mark as sent in database
                    await supabaseAdmin.rpc('mark_notification_email_sent', {
                        p_notification_id: notification.notification_id,
                    });
                    results.sent++;
                } else {
                    results.failed++;
                    results.errors.push(`Failed to send email for notification ${notification.notification_id}`);
                }
            } catch (err) {
                results.failed++;
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                results.errors.push(`Error processing ${notification.notification_id}: ${errorMessage}`);
                console.error(`Error processing notification ${notification.notification_id}:`, err);
            }
        }

        console.log(`Notification email processing complete: ${results.sent} sent, ${results.failed} failed`);

        return res.json(results);
    } catch (err) {
        console.error('Error in process-emails endpoint:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get notification email processing status (for admin monitoring)
 * GET /api/notifications/status
 */
router.get('/status', async (req: Request, res: Response) => {
    // Verify authorization (Bearer token from Supabase)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    try {
        // Verify the token and check if user is admin
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user is admin
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || !['admin', 'superadmin'].includes(profile.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get pending email count
        const { count: pendingCount } = await supabaseAdmin
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('email_pending', true);

        // Get sent emails in last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: sentCount } = await supabaseAdmin
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('email_pending', false)
            .not('email_sent_at', 'is', null)
            .gte('email_sent_at', yesterday);

        return res.json({
            pending_emails: pendingCount || 0,
            sent_last_24h: sentCount || 0,
        });
    } catch (err) {
        console.error('Error in notifications status endpoint:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export const notificationsRouter = router;
