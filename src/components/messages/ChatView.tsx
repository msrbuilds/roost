import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { getConversationMessages, sendMessage, markConversationAsRead, getMessageById } from '../../services/message';
import { supabase } from '../../services/supabase';
import type { Conversation, MessageWithSender } from '../../services/message';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import OnlineIndicator from '../common/OnlineIndicator';
import { ProBadge } from '../common/ProBadge';

interface ChatViewProps {
  conversation: Conversation | null;
  onBack?: () => void;
}

const MESSAGES_PER_PAGE = 50;

export default function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeight = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async (showLoading = true) => {
    if (!user || !conversation) return;

    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [data] = await Promise.all([
        getConversationMessages(user.id, conversation.otherUser.id, MESSAGES_PER_PAGE, 0),
        markConversationAsRead(user.id, conversation.otherUser.id),
      ]);
      setMessages(data);
      setHasMore(data.length >= MESSAGES_PER_PAGE);

      // Scroll to bottom after initial load
      if (showLoading) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [user, conversation]);

  const loadMoreMessages = useCallback(async () => {
    if (!user || !conversation || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const container = messagesContainerRef.current;
    if (container) {
      previousScrollHeight.current = container.scrollHeight;
    }

    try {
      const olderMessages = await getConversationMessages(
        user.id,
        conversation.otherUser.id,
        MESSAGES_PER_PAGE,
        messages.length
      );

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setHasMore(olderMessages.length >= MESSAGES_PER_PAGE);

        // Restore scroll position
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - previousScrollHeight.current;
          }
        }, 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, conversation, messages.length, isLoadingMore, hasMore]);

  // Initial load
  useEffect(() => {
    if (conversation) {
      loadMessages();
    }
  }, [conversation, loadMessages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user || !conversation) return;

    const channel = supabase
      .channel(`conversation-${conversation.otherUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${conversation.otherUser.id},recipient_id=eq.${user.id}`
      }, async (payload) => {
        const newMessage = await getMessageById(payload.new.id);
        if (newMessage) {
          setMessages(prev => [...prev, newMessage]);
          setTimeout(scrollToBottom, 100);

          // Mark as read if chat is focused
          if (document.hasFocus()) {
            await markConversationAsRead(user.id, conversation.otherUser.id);
          }
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${user.id},recipient_id=eq.${conversation.otherUser.id}`
      }, async (payload) => {
        // Handle messages sent from another tab/device
        const newMessage = await getMessageById(payload.new.id);
        if (newMessage) {
          const exists = messages.find(m => m.id === newMessage.id);
          if (!exists) {
            setMessages(prev => [...prev, newMessage]);
            setTimeout(scrollToBottom, 100);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversation, messages]);

  // Infinite scroll observer
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore) return;

    const handleScroll = () => {
      if (container.scrollTop < 100 && !isLoadingMore) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loadMoreMessages]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!user || !conversation) return;

    // Optimistic update
    const optimisticMessage: MessageWithSender = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      recipient_id: conversation.otherUser.id,
      content,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.email?.split('@')[0] || '',
        display_name: user.user_metadata?.display_name || 'You',
        avatar_url: user.user_metadata?.avatar_url,
        is_online: true,
        membership_type: user.user_metadata?.membership_type || null
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 100);

    try {
      const actualMessage = await sendMessage(conversation.otherUser.id, content, files);
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? actualMessage : m));
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setError('Failed to send message. Please try again.');
    }
  };

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative flex-shrink-0">
          {conversation.otherUser.avatar_url ? (
            <img
              src={conversation.otherUser.avatar_url}
              alt={conversation.otherUser.display_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
              {conversation.otherUser.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute bottom-0 right-0">
            <OnlineIndicator
              isOnline={conversation.otherUser.is_online ?? false}
              size="sm"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-surface-900 dark:text-surface-100 truncate">
              {conversation.otherUser.display_name}
            </h2>
            {conversation.otherUser.membership_type === 'premium' && <ProBadge size="xs" />}
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            @{conversation.otherUser.username}
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-error text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
        {isLoadingMore && (
          <div className="flex justify-center mb-4">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSent={message.sender_id === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSendMessage}
        disabled={isLoading}
      />
    </div>
  );
}
