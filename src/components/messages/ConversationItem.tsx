import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '../../services/message';
import OnlineIndicator from '../common/OnlineIndicator';
import { ProBadge } from '../common/ProBadge';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const { otherUser, lastMessage, unreadCount, lastMessageAt } = conversation;

  // Truncate last message content
  const truncateContent = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 transition-colors ${isSelected
          ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-600'
          : 'hover:bg-surface-50 dark:hover:bg-surface-800 border-l-4 border-transparent'
        }`}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        {otherUser.avatar_url ? (
          <img
            src={otherUser.avatar_url}
            alt={otherUser.display_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
            {otherUser.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute bottom-0 right-0">
          <OnlineIndicator
            isOnline={otherUser.is_online ?? false}
          />
        </div>
      </div>

      {/* Conversation details */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className={`font-medium truncate ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-surface-900 dark:text-surface-100'}`}>
              {otherUser.display_name}
            </h3>
            {otherUser.membership_type === 'premium' && <ProBadge size="xs" />}
          </div>
          <span className="text-xs text-surface-400 dark:text-surface-500 flex-shrink-0 ml-2">
            {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-sm truncate ${unreadCount > 0 ? 'font-medium text-surface-900 dark:text-surface-100' : 'text-surface-500 dark:text-surface-400'}`}>
            {truncateContent(lastMessage.content)}
          </p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-primary-600 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
