"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
exports.constructWebhookEvent = constructWebhookEvent;
exports.findOrCreateCustomer = findOrCreateCustomer;
exports.createCheckoutSession = createCheckoutSession;
exports.createPortalSession = createPortalSession;
exports.getSubscriptionStatus = getSubscriptionStatus;
exports.getStripe = getStripe;
const stripe_1 = __importDefault(require("stripe"));
const supabase_js_1 = require("../lib/supabase.js");
// Initialize Stripe with secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_SECRET_KEY) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured — Stripe features will be unavailable');
}
const stripe = STRIPE_SECRET_KEY
    ? new stripe_1.default(STRIPE_SECRET_KEY)
    : null;
exports.stripe = stripe;
function getStripe() {
    if (!stripe) {
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
    return stripe;
}
/**
 * Verify a Stripe webhook event signature
 */
function constructWebhookEvent(rawBody, signature) {
    if (!STRIPE_WEBHOOK_SECRET) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
    return getStripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}
/**
 * Find or create a Stripe customer for a user
 */
async function findOrCreateCustomer(userId, email) {
    // Check local DB first
    const { data: existing } = await supabase_js_1.supabaseAdmin
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
    await supabase_js_1.supabaseAdmin
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
async function createCheckoutSession(userId, email, priceId, successUrl, cancelUrl) {
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
async function createPortalSession(userId, returnUrl) {
    // Look up Stripe customer ID for this user
    const { data: customer } = await supabase_js_1.supabaseAdmin
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
async function getSubscriptionStatus(userId) {
    const { data: subscription } = await supabase_js_1.supabaseAdmin
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
//# sourceMappingURL=stripe.js.map