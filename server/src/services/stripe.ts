import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase.js';

// Initialize Stripe with secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY not configured — Stripe features will be unavailable');
}

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

/**
 * Verify a Stripe webhook event signature
 */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string
): Stripe.Event {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Find or create a Stripe customer for a user
 */
export async function findOrCreateCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check local DB first
  const { data: existing } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // Create customer in Stripe
  const customer = await getStripe().customers.create({
    email,
    metadata: { user_id: userId },
  });

  // Store mapping in local DB
  await supabaseAdmin
    .from('stripe_customers')
    .upsert({
      stripe_customer_id: customer.id,
      user_id: userId,
      email,
    }, {
      onConflict: 'stripe_customer_id',
    });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const customerId = await findOrCreateCustomer(userId, email);

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { user_id: userId },
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return session.url;
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  // Look up Stripe customer ID for this user
  const { data: customer } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!customer?.stripe_customer_id) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Get subscription status from local DB
 */
export async function getSubscriptionStatus(userId: string) {
  const { data: subscription } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    return {
      hasSubscription: false,
      status: null,
      isActive: false,
    };
  }

  const isActive = subscription.status === 'active';
  const inGracePeriod = subscription.status === 'cancelled' &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) > new Date();

  return {
    hasSubscription: true,
    status: subscription.status,
    isActive: isActive || inGracePeriod,
    inGracePeriod,
    currentPeriodEnd: subscription.current_period_end,
    currentPeriodStart: subscription.current_period_start,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

export { stripe, getStripe };
