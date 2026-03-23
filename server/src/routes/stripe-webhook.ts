import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase.js';
import { constructWebhookEvent } from '../services/stripe.js';
import { invalidateWebhookRelatedCaches } from '../services/cache.js';

export const stripeWebhookRouter = Router();

// Map Stripe subscription status to our local status
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'failed_payment';
    case 'canceled':
    case 'unpaid':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'cancelled';
  }
}

// Log webhook event to database
async function logWebhook(
  eventType: string,
  stripeEventId: string,
  payload: Record<string, unknown>,
  ipAddress: string | null
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .insert({
      event_type: eventType,
      stripe_event_id: stripeEventId,
      payload,
      ip_address: ipAddress,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Stripe Webhook] Failed to log event:', error);
    return null;
  }
  return data?.id || null;
}

// Mark webhook as processed
async function markWebhookProcessed(logId: string, errorMessage?: string) {
  await supabaseAdmin
    .from('stripe_webhook_logs')
    .update({
      processed: !errorMessage,
      error_message: errorMessage || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

// Find user ID from Stripe customer ID via local DB
async function findUserByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  return data?.user_id || null;
}

// Update user membership type
async function updateMembershipType(userId: string, type: 'premium' | 'free') {
  await supabaseAdmin
    .from('profiles')
    .update({
      membership_type: type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !stripeCustomerId) {
    console.error('[Stripe Webhook] Missing userId or customerId in checkout session');
    return;
  }

  // Ensure customer mapping exists
  await supabaseAdmin
    .from('stripe_customers')
    .upsert({
      stripe_customer_id: stripeCustomerId,
      user_id: userId,
      email: session.customer_email || session.customer_details?.email || '',
    }, {
      onConflict: 'stripe_customer_id',
    });

  // If this is a subscription checkout, the subscription events will handle the rest
  // But we can set premium immediately for responsiveness
  if (subscriptionId) {
    await updateMembershipType(userId, 'premium');
  }
}

// Handle subscription created or updated
async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = subscription.customer as string;
  const userId = await findUserByStripeCustomer(stripeCustomerId);

  if (!userId) {
    console.warn(`[Stripe Webhook] No user found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const priceItem = subscription.items.data[0];

  // Period dates are on subscription items in newer Stripe API versions
  const periodStart = priceItem?.current_period_start
    ? new Date(priceItem.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = priceItem?.current_period_end
    ? new Date(priceItem.current_period_end * 1000).toISOString()
    : null;

  // Upsert subscription record
  await supabaseAdmin
    .from('stripe_subscriptions')
    .upsert({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      user_id: userId,
      stripe_price_id: priceItem?.price?.id || '',
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancelled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      ended_at: subscription.ended_at
        ? new Date(subscription.ended_at * 1000).toISOString()
        : null,
    }, {
      onConflict: 'stripe_subscription_id',
    });

  // Update membership type based on status
  if (status === 'active') {
    await updateMembershipType(userId, 'premium');
  } else if (status === 'cancelled' || status === 'expired') {
    // Check if user has any other active subscriptions
    const { data: activeSubs } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('stripe_subscription_id', subscription.id)
      .limit(1);

    if (!activeSubs || activeSubs.length === 0) {
      await updateMembershipType(userId, 'free');
    }
  }

  // Invalidate caches
  await invalidateWebhookRelatedCaches(userId);
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = subscription.customer as string;
  const userId = await findUserByStripeCustomer(stripeCustomerId);

  if (!userId) {
    console.warn(`[Stripe Webhook] No user found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  // Update subscription status
  await supabaseAdmin
    .from('stripe_subscriptions')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Check if user has other active subscriptions
  const { data: activeSubs } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  if (!activeSubs || activeSubs.length === 0) {
    await updateMembershipType(userId, 'free');

    // Notify user
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'new_message',
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled. You can resubscribe at any time to regain premium access.',
      });
  }

  await invalidateWebhookRelatedCaches(userId);
}

// Extract subscription ID from invoice
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

// Handle invoice payment failed
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const stripeCustomerId = invoice.customer as string;
  const userId = await findUserByStripeCustomer(stripeCustomerId);

  if (!userId) return;

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (subscriptionId) {
    await supabaseAdmin
      .from('stripe_subscriptions')
      .update({ status: 'failed_payment' })
      .eq('stripe_subscription_id', subscriptionId);
  }

  // Notify user
  await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'new_message',
      title: 'Payment Failed',
      message: 'Your subscription payment failed. Please update your payment method to keep your premium access.',
    });

  await invalidateWebhookRelatedCaches(userId);
}

// Main webhook endpoint
stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(req.body as Buffer, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  // Idempotency check
  const { data: existingLog } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingLog) {
    console.log(`[Stripe Webhook] Duplicate event ${event.id}, skipping`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Log the event
  const logId = await logWebhook(
    event.type,
    event.id,
    event.data.object as unknown as Record<string, unknown>,
    ipAddress
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded': {
        // Ensure user stays premium on renewal
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await findUserByStripeCustomer(customerId);
        if (userId) {
          await updateMembershipType(userId, 'premium');
          await invalidateWebhookRelatedCaches(userId);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    if (logId) {
      await markWebhookProcessed(logId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
    if (logId) {
      await markWebhookProcessed(logId, message);
    }
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

// Health check
stripeWebhookRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'stripe-webhook' });
});
