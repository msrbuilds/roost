import { useState, useEffect, useCallback, useRef } from 'react';
import { liveRoomService, type LiveStatus } from '@/services/live-room';
import { useAuth } from '@/contexts/AuthContext';

// Module-level cache so multiple components share the same data
let cachedStatus: LiveStatus | null = null;
let lastFetchTime = 0;
const BASE_INTERVAL = 30_000; // 30 seconds
const MAX_INTERVAL = 5 * 60_000; // 5 minutes max backoff

export function useLiveStatus() {
  const { user, isPremium } = useAuth();
  const [status, setStatus] = useState<LiveStatus | null>(cachedStatus);
  const failCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getInterval = useCallback(() => {
    if (failCountRef.current === 0) return BASE_INTERVAL;
    // Exponential backoff: 30s, 60s, 120s, 240s, capped at 5min
    return Math.min(BASE_INTERVAL * Math.pow(2, failCountRef.current), MAX_INTERVAL);
  }, []);

  const scheduleNext = useCallback((fetchFn: () => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchFn, getInterval());
  }, [getInterval]);

  const fetchStatus = useCallback(async () => {
    if (!user || !isPremium) return;

    try {
      const data = await liveRoomService.getStatus();
      cachedStatus = data;
      lastFetchTime = Date.now();
      setStatus(data);
      if (failCountRef.current > 0) {
        failCountRef.current = 0;
        scheduleNext(() => fetchStatus());
      }
    } catch {
      failCountRef.current = Math.min(failCountRef.current + 1, 5);
      scheduleNext(() => fetchStatus());
    }
  }, [user, isPremium, scheduleNext]);

  useEffect(() => {
    if (!user || !isPremium) {
      setStatus(null);
      return;
    }

    // Use cache if fresh
    if (cachedStatus && Date.now() - lastFetchTime < BASE_INTERVAL) {
      setStatus(cachedStatus);
    } else {
      fetchStatus();
    }

    // Start polling
    intervalRef.current = setInterval(fetchStatus, getInterval());
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, isPremium, fetchStatus, getInterval]);

  return {
    isLive: status?.isLive ?? false,
    session: status?.session ?? null,
  };
}
