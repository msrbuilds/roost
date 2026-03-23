import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
} from '../services/stripe.js';
import {
  getCachedSubscriptionStatus,
  getCachedDashboardStats,
  getCachedUserProfile,
  invalidateStripeCaches,
  invalidateDashboardStats,
  type SubscriptionStatus,
  type DashboardStats,
} from '../services/cache.js';

export const stripeApiRouter = Router();

// Default price ID from environment
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';

// Middleware to verify admin authorization (with cached profile lookup)
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const profile = await getCachedUserProfile(user.id, async () => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, role, is_banned')
        .eq('id', user.id)
        .single();
      return data;
    });

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (profile.is_banned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Authorization failed' });
  }
}

// Get subscription status for current user (cached)
stripeApiRouter.get('/subscription-status', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const status = await getCachedSubscriptionStatus(user.id, async (): Promise<SubscriptionStatus> => {
      return getSubscriptionStatus(user.id);
    });

    res.json(status);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Create a Stripe Checkout session
stripeApiRouter.post('/create-checkout-session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const priceId = req.body.priceId || STRIPE_PRICE_ID;

    if (!priceId) {
      return res.status(400).json({ error: 'No price ID configured. Set STRIPE_PRICE_ID environment variable.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = `${frontendUrl}/?payment=success`;
    const cancelUrl = `${frontendUrl}/upgrade`;

    const url = await createCheckoutSession(
      user.id,
      user.email || '',
      priceId,
      successUrl,
      cancelUrl
    );

    res.json({ url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create a Stripe Customer Portal session
stripeApiRouter.post('/create-portal-session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = await createPortalSession(user.id, `${frontendUrl}/settings`);

    res.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('No Stripe customer found')) {
      return res.status(404).json({ error: 'No subscription found. Subscribe first to manage your subscription.' });
    }
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Get subscription stats (Admin only, cached)
stripeApiRouter.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getCachedDashboardStats(async (): Promise<DashboardStats> => {
      const [
        { count: customerCount },
        { count: activeSubscriptions },
        { count: cancelledSubscriptions },
        { count: totalWebhooks },
        { count: failedWebhooks },
      ] = await Promise.all([
        supabaseAdmin.from('stripe_customers').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('stripe_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabaseAdmin.from('stripe_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabaseAdmin.from('stripe_webhook_logs').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('stripe_webhook_logs').select('*', { count: 'exact', head: true }).eq('processed', false),
      ]);

      // Get recent webhook logs
      const { data: recentWebhooks } = await supabaseAdmin
        .from('stripe_webhook_logs')
        .select('id, event_type, processed, created_at, error_message, stripe_event_id, payload, ip_address')
        .order('created_at', { ascending: false })
        .limit(10);

      const enrichedWebhooks = (recentWebhooks || []).map(webhook => {
        const payload = webhook.payload as Record<string, unknown> | null;
        return {
          id: webhook.id,
          event_type: webhook.event_type,
          processed: webhook.processed,
          created_at: webhook.created_at,
          error_message: webhook.error_message,
          stripe_event_id: webhook.stripe_event_id,
          ip_address: webhook.ip_address,
          email: (payload?.customer_email || payload?.email) as string | undefined,
        };
      });

      return {
        customers: customerCount || 0,
        subscriptions: {
          active: activeSubscriptions || 0,
          cancelled: cancelledSubscriptions || 0,
        },
        webhooks: {
          total: totalWebhooks || 0,
          failed: failedWebhooks || 0,
          recent: enrichedWebhooks,
        },
      };
    });

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Run cleanup for expired subscriptions (Admin only)
stripeApiRouter.post('/cleanup', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Find expired subscriptions (cancelled and past period end)
    const { data: expiredSubs } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('id, user_id')
      .eq('status', 'cancelled')
      .lt('current_period_end', new Date().toISOString());

    if (!expiredSubs || expiredSubs.length === 0) {
      return res.json({ message: 'No expired subscriptions to process' });
    }

    let processed = 0;

    for (const sub of expiredSubs) {
      await supabaseAdmin
        .from('stripe_subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id);

      if (sub.user_id) {
        // Check for other active subscriptions
        const { data: activeSubs } = await supabaseAdmin
          .from('stripe_subscriptions')
          .select('id')
          .eq('user_id', sub.user_id)
          .eq('status', 'active')
          .limit(1);

        if (!activeSubs || activeSubs.length === 0) {
          await supabaseAdmin
            .from('profiles')
            .update({ membership_type: 'free' })
            .eq('id', sub.user_id);
        }

        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: sub.user_id,
            type: 'new_message',
            title: 'Subscription Expired',
            message: 'Your subscription has expired. Please renew to regain premium access.',
          });
      }

      processed++;
    }

    await invalidateStripeCaches();

    res.json({
      success: true,
      message: `Processed ${processed} expired subscriptions`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});
