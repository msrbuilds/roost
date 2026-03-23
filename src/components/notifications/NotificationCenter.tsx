import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Bell, CheckCheck, X } from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notification';
import { supabase } from '../../services/supabase';
import type { Notification } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import NotificationItem from './NotificationItem';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const NOTIFICATIONS_PER_PAGE = 20;

export default function NotificationCenter({ isOpen, onClose, onNavigate, onUnreadCountChange }: NotificationCenterProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (showLoading = true, reset = false) => {
    if (!user) return;

    const currentOffset = reset ? 0 : offset;

    if (showLoading) {
      setIsLoading(true);
    }
    if (reset) {
      setOffset(0);
      setHasMore(true);
    }
    setError(null);

    try {
      const data = await getNotifications(user.id, NOTIFICATIONS_PER_PAGE, currentOffset);

      if (reset) {
        setNotifications(data);
      } else {
        setNotifications(prev => [...prev, ...data]);
      }
      setHasMore(data.length >= NOTIFICATIONS_PER_PAGE);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
      setLoadingMore(false);
    }
  }, [user, offset]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !user) return;

    setLoadingMore(true);
    const newOffset = offset + NOTIFICATIONS_PER_PAGE;
    setOffset(newOffset);

    try {
      const data = await getNotifications(user.id, NOTIFICATIONS_PER_PAGE, newOffset);
      setNotifications(prev => [...prev, ...data]);
      setHasMore(data.length >= NOTIFICATIONS_PER_PAGE);
    } catch (err) {
      console.error('Error loading more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, offset, hasMore, loadingMore]);

  // Load notifications when opened
  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setNotifications([]);
      setOffset(0);
      setHasMore(true);
      loadNotifications(true, true);
    }
  }, [isOpen]);

  // Infinite scroll observer
  useEffect(() => {
    if (!isOpen) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, root: scrollContainerRef.current }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [isOpen, hasMore, loadingMore, isLoading, loadMore]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user || !isOpen) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Reload from beginning on real-time update
        setNotifications([]);
        setOffset(0);
        setHasMore(true);
        loadNotifications(false, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.is_read) {
      await markAsRead(notification.id);
      // Update the unread badge count in parent
      const newUnread = notifications.filter(n => !n.is_read && n.id !== notification.id).length;
      onUnreadCountChange?.(newUnread);
    }

    // Navigate to link if provided
    if (notification.link) {
      navigate(notification.link);
    }

    // Close dropdown and notify parent
    onClose();
    if (onNavigate) {
      onNavigate();
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    try {
      await markAllAsRead(user.id);
      await loadNotifications(false);
      onUnreadCountChange?.(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      {/* Backdrop - transparent on desktop, dark overlay on mobile */}
      <div
        className="fixed inset-0 z-40 md:bg-transparent bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Desktop: Dropdown | Mobile: Slide-in panel from right */}
      <div className="
        fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-surface-900 shadow-elevated dark:shadow-elevated-dark border-l border-surface-200 dark:border-surface-700 z-50 flex flex-col animate-slide-in-right
        md:absolute md:inset-y-auto md:right-0 md:top-full md:mt-2 md:w-96 md:max-h-[600px] md:rounded-lg md:border md:animate-none
      ">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-error mb-2">{error}</p>
              <button onClick={() => loadNotifications(true, true)} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm text-surface-500 dark:text-surface-400">No notifications yet</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                You'll be notified about comments, reactions, and messages
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={observerTarget} className="py-4 text-center">
                  {loadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Loading more...</span>
                    </div>
                  ) : (
                    <span className="text-xs text-surface-400 dark:text-surface-500">Scroll for more</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
