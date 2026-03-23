import { useState, useEffect, useCallback } from 'react';
import { subscriptionService, SubscriptionStatus } from '@/services/subscription';
import { useAuth } from '@/contexts/AuthContext';

interface UseSubscriptionResult {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  isActive: boolean;
  inGracePeriod: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const status = await subscriptionService.getStatus();
      setSubscription(status);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription({
        hasSubscription: false,
        status: null,
        isActive: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) {
      fetchSubscription();
    }
  }, [authLoading, fetchSubscription]);

  return {
    subscription,
    isLoading: authLoading || isLoading,
    isActive: subscription?.isActive ?? false,
    inGracePeriod: subscription?.inGracePeriod ?? false,
    refresh: fetchSubscription,
  };
}

export default useSubscription;
