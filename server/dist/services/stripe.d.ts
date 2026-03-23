import Stripe from 'stripe';
declare const stripe: Stripe | null;
declare function getStripe(): Stripe;
/**
 * Verify a Stripe webhook event signature
 */
export declare function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event;
/**
 * Find or create a Stripe customer for a user
 */
export declare function findOrCreateCustomer(userId: string, email: string): Promise<string>;
/**
 * Create a Stripe Checkout session for subscription
 */
export declare function createCheckoutSession(userId: string, email: string, priceId: string, successUrl: string, cancelUrl: string): Promise<string>;
/**
 * Create a Stripe Customer Portal session
 */
export declare function createPortalSession(userId: string, returnUrl: string): Promise<string>;
/**
 * Get subscription status from local DB
 */
export declare function getSubscriptionStatus(userId: string): Promise<{
    hasSubscription: boolean;
    status: null;
    isActive: boolean;
    inGracePeriod?: undefined;
    currentPeriodEnd?: undefined;
    currentPeriodStart?: undefined;
    cancelAtPeriodEnd?: undefined;
} | {
    hasSubscription: boolean;
    status: any;
    isActive: any;
    inGracePeriod: any;
    currentPeriodEnd: any;
    currentPeriodStart: any;
    cancelAtPeriodEnd: any;
}>;
export { stripe, getStripe };
//# sourceMappingURL=stripe.d.ts.map