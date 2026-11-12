import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase.js';
import { constructWebhookEvent } from '../services/stripe.js';
import { invalidateWebhookRelatedCaches } from '../services/cache.js';

export const stripeWebhookRouter = Router();

const ALLOWED_PRICE_IDS = new Set(
  [process.env.STRIPE_PRICE_ID || '', ...(process.env.STRIPE_ALLOWED_PRICE_IDS || '').split(',')]
    .map((value) => value.trim())
    .filter(Boolean)
);

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
): Promise<string> {
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
    throw new Error(`Failed to persist Stripe event: ${error.message}`);
  }
  if (!data?.id) throw new Error('Stripe event log did not return an id');
  return data.id;
}

// Mark webhook as processed
async function markWebhookProcessed(logId: string, errorMessage?: string) {
  const { error } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .update({
      processed: !errorMessage,
      error_message: errorMessage || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', logId);
  if (error) throw new Error(`Failed to update Stripe event log: ${error.message}`);
}

// Find user ID from Stripe customer ID via local DB
async function findUserByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Stripe customer lookup failed: ${error.message}`);
  return data?.user_id || null;
}

// Update user membership type
async function updateMembershipType(userId: string, type: 'premium' | 'free') {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      membership_type: type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(`Membership update failed: ${error.message}`);
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;

  if (!userId || !stripeCustomerId) {
    throw new Error('Checkout session is missing its user or customer mapping');
  }

  // Ensure customer mapping exists
  const { error: customerError } = await supabaseAdmin
    .from('stripe_customers')
    .upsert({
      stripe_customer_id: stripeCustomerId,
      user_id: userId,
      email: session.customer_email || session.customer_details?.email || '',
    }, {
      onConflict: 'stripe_customer_id',
    });
  if (customerError) throw new Error(`Customer mapping failed: ${customerError.message}`);

  // Membership changes only after a subscription event verifies an allowed price.
}

// Handle subscription created or updated
async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = subscription.customer as string;
  const userId = await findUserByStripeCustomer(stripeCustomerId);

  if (!userId) {
    throw new Error(`No user mapping exists for Stripe customer ${stripeCustomerId}`);
  }

  const status = mapStripeStatus(subscription.status);
  const priceItem = subscription.items.data[0];
  const priceId = priceItem?.price?.id;
  if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
    throw new Error(`Subscription ${subscription.id} uses an unapproved Stripe price`);
  }

  // Period dates are on subscription items in newer Stripe API versions
  const periodStart = priceItem?.current_period_start
    ? new Date(priceItem.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = priceItem?.current_period_end
    ? new Date(priceItem.current_period_end * 1000).toISOString()
    : null;

  // Upsert subscription record
  const { error: subscriptionError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .upsert({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      user_id: userId,
      stripe_price_id: priceId,
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
  if (subscriptionError) throw new Error(`Subscription upsert failed: ${subscriptionError.message}`);

  // Update membership type based on status
  if (status === 'active') {
    await updateMembershipType(userId, 'premium');
  } else if (status === 'cancelled' || status === 'expired' || status === 'failed_payment') {
    // Check if user has any other active subscriptions
    const { data: activeSubs, error: activeError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('stripe_subscription_id', subscription.id)
      .limit(1);
    if (activeError) throw new Error(`Active subscription lookup failed: ${activeError.message}`);

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
    throw new Error(`No user mapping exists for Stripe customer ${stripeCustomerId}`);
  }

  // Update subscription status
  const { error: cancelError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
  if (cancelError) throw new Error(`Subscription cancellation update failed: ${cancelError.message}`);

  // Check if user has other active subscriptions
  const { data: activeSubs, error: activeError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (activeError) throw new Error(`Active subscription lookup failed: ${activeError.message}`);

  if (!activeSubs || activeSubs.length === 0) {
    await updateMembershipType(userId, 'free');

    // Notify user
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'new_message',
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled. You can resubscribe at any time to regain premium access.',
      });
    if (notificationError) throw new Error(`Cancellation notification failed: ${notificationError.message}`);
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

  if (!userId) throw new Error(`No user mapping exists for Stripe customer ${stripeCustomerId}`);

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (subscriptionId) {
    const { error: paymentUpdateError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .update({ status: 'failed_payment' })
      .eq('stripe_subscription_id', subscriptionId);
    if (paymentUpdateError) throw new Error(`Payment status update failed: ${paymentUpdateError.message}`);
  }

  const { data: activeSubs, error: activeLookupError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (activeLookupError) throw new Error(`Active subscription lookup failed: ${activeLookupError.message}`);
  if (!activeSubs || activeSubs.length === 0) await updateMembershipType(userId, 'free');

  // Notify user
  const { error: notificationError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'new_message',
      title: 'Payment Failed',
      message: 'Your subscription payment failed. Please update your payment method to keep your premium access.',
    });
  if (notificationError) throw new Error(`Payment failure notification failed: ${notificationError.message}`);

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
  const { data: existingLog, error: existingError } = await supabaseAdmin
    .from('stripe_webhook_logs')
    .select('id, processed')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingError) {
    console.error('[Stripe Webhook] Idempotency lookup failed:', existingError);
    return res.status(500).json({ error: 'Could not verify webhook idempotency' });
  }

  if (existingLog?.processed) {
    console.log(`[Stripe Webhook] Duplicate event ${event.id}, skipping`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Log the event
  let logId = existingLog?.id;
  try {
    if (logId) {
      const { error: retryError } = await supabaseAdmin.from('stripe_webhook_logs').update({
        processed: false,
        error_message: null,
        processed_at: null,
        payload: event.data.object as unknown as Record<string, unknown>,
      }).eq('id', logId);
      if (retryError) throw retryError;
    } else {
      logId = await logWebhook(event.type, event.id, event.data.object as unknown as Record<string, unknown>, ipAddress);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Event persistence failed:', error);
    return res.status(500).json({ error: 'Could not persist webhook event' });
  }

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
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break; // One-time invoices do not grant membership.
        const { data: localSubscription, error: subscriptionLookupError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .select('user_id, stripe_price_id, status')
          .eq('stripe_subscription_id', subscriptionId)
          .single();
        if (subscriptionLookupError || !localSubscription) throw new Error('Renewal subscription is not registered');
        if (!ALLOWED_PRICE_IDS.has(localSubscription.stripe_price_id)) throw new Error('Renewal uses an unapproved Stripe price');
        if (localSubscription.status !== 'active') throw new Error('Renewal subscription is not active');
        await updateMembershipType(localSubscription.user_id, 'premium');
        await invalidateWebhookRelatedCaches(localSubscription.user_id);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    await markWebhookProcessed(logId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
    try { await markWebhookProcessed(logId, message); } catch (logError) { console.error('[Stripe Webhook] Failed to record processing failure:', logError); }
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  return res.status(200).json({ received: true });
});

// Health check
stripeWebhookRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'stripe-webhook' });
});
