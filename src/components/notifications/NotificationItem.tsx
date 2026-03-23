import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, Mail, UserPlus, Users, AtSign, UserCheck, Bell, Reply } from 'lucide-react';
import type { Notification } from '../../types/database';
import { getNotificationIconInfo } from '../../services/notification';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: () => void;
}

// Map notification types to Lucide icons
const iconMap = {
  MessageSquare,
  Heart,
  Mail,
  UserPlus,
  Users,
  AtSign,
  UserCheck,
  Bell,
  Reply
};

export default function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const { icon: iconName, color } = getNotificationIconInfo(notification.type);
  const Icon = iconMap[iconName as keyof typeof iconMap] || Bell;

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 p-3 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-left ${!notification.is_read ? 'bg-primary-50/30 dark:bg-primary-900/20' : ''
        }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${notification.is_read ? 'bg-surface-100 dark:bg-surface-800' : 'bg-primary-100 dark:bg-primary-900/30'} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${notification.is_read ? 'text-surface-600 dark:text-surface-400' : color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.is_read ? 'text-surface-700 dark:text-surface-300' : 'text-surface-900 dark:text-surface-100 font-medium'}`}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
          {formatDistanceToNow(new Date(notification.created_at || Date.now()), { addSuffix: true })}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-600 mt-2" />
      )}
    </button>
  );
}
