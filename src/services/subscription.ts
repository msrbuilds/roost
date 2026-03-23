import { supabase } from './supabase';

// Backend server URL - should be configured via environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface SubscriptionStatus {
  hasSubscription: boolean;
  status: 'active' | 'cancelled' | 'expired' | 'failed_payment' | 'refunded' | 'past_due' | null;
  isActive: boolean;
  inGracePeriod?: boolean;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface WebhookLog {
  id: string;
  event_type: string;
  processed: boolean;
  created_at: string;
  error_message?: string;
  stripe_event_id?: string;
  ip_address?: string;
  email?: string;
}

export interface StripeStats {
  customers: number;
  subscriptions: {
    active: number;
    cancelled: number;
  };
  webhooks: {
    total: number;
    failed: number;
    recent: WebhookLog[];
  };
}

// Get auth token from current session
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Subscription Service
export const subscriptionService = {
  // Get current user's subscription status
  async getStatus(): Promise<SubscriptionStatus> {
    const token = await getAuthToken();
    if (!token) {
      return {
        hasSubscription: false,
        status: null,
        isActive: false,
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/stripe/subscription-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      // Fall back to database query
      return this.getStatusFromDatabase();
    }
  },

  // Fallback: Get status directly from database
  async getStatusFromDatabase(): Promise<SubscriptionStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        hasSubscription: false,
        status: null,
        isActive: false,
      };
    }

    const { data: subscription, error } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !subscription) {
      return {
        hasSubscription: false,
        status: null,
        isActive: false,
      };
    }

    const isActive = subscription.status === 'active';
    const inGracePeriod = subscription.status === 'cancelled' &&
      !!subscription.current_period_end &&
      new Date(subscription.current_period_end) > new Date();

    return {
      hasSubscription: true,
      status: subscription.status,
      isActive: isActive || inGracePeriod,
      inGracePeriod: inGracePeriod || undefined,
      currentPeriodEnd: subscription.current_period_end ?? undefined,
      currentPeriodStart: subscription.current_period_start ?? undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? undefined,
    };
  },

  // Check if user has active subscription (quick check)
  async hasActiveSubscription(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('has_active_subscription', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Error checking subscription:', error);
      return false;
    }

    return data === true;
  },

  // Create a Stripe Checkout session and return the URL
  async createCheckoutSession(priceId?: string): Promise<string> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data.url;
  },

  // Create a Stripe Customer Portal session and return the URL
  async createPortalSession(): Promise<string> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/stripe/create-portal-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create portal session');
    }

    const data = await response.json();
    return data.url;
  },
};

// Admin functions for managing Stripe subscriptions
export const stripeAdminService = {
  // Get stats
  async getStats(): Promise<StripeStats> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/stripe/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    return response.json();
  },

  // Run cleanup for expired subscriptions
  async runCleanup(): Promise<{ message: string }> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/stripe/cleanup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to run cleanup');
    }

    return response.json();
  },
};
