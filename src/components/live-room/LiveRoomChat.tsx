import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { supabase } from '@/services/supabase';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  type LiveChatMessage,
} from '@/services/live-chat';

interface LiveRoomChatProps {
  sessionId: string;
}

export default function LiveRoomChat({ sessionId }: LiveRoomChatProps) {
  const { user, profile, isPlatformAdmin } = useAuth();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Track if user is scrolled to bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  // Load initial messages
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getMessages(sessionId);
        if (!cancelled) {
          setMessages(data);
          setIsLoading(false);
          // Scroll to bottom after initial load
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error('Error loading chat messages:', error);
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId, scrollToBottom]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`live-chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // Fetch the full message with profile join
          const { data } = await supabase
            .from('live_session_messages')
            .select('id, session_id, user_id, content, created_at, profiles:user_id(display_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              // Avoid duplicates (from optimistic update)
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as unknown as LiveChatMessage];
            });

            if (shouldAutoScroll.current) {
              setTimeout(scrollToBottom, 50);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'live_session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || !user || isSending) return;

    const content = input.trim();
    setInput('');
    setIsSending(true);

    // Optimistic update
    const optimisticMsg: LiveChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      profiles: {
        display_name: profile?.display_name || 'You',
        avatar_url: profile?.avatar_url || null,
      },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    shouldAutoScroll.current = true;
    setTimeout(scrollToBottom, 50);

    try {
      const saved = await sendMessage(sessionId, user.id, content);
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? saved : m))
      );
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(content); // Restore input
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900">
      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-400 dark:text-surface-500 text-sm">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div
                key={msg.id}
                className="group flex items-start gap-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded-lg px-2 -mx-1"
              >
                {/* Avatar */}
                {msg.profiles?.avatar_url ? (
                  <img
                    src={msg.profiles.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      {(msg.profiles?.display_name || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-semibold truncate ${isOwn ? 'text-primary-600 dark:text-primary-400' : 'text-surface-900 dark:text-surface-100'}`}>
                      {msg.profiles?.display_name || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-surface-400 dark:text-surface-500 flex-shrink-0">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 dark:text-surface-300 break-words">
                    {msg.content}
                  </p>
                </div>

                {/* Delete button (own messages or admin) */}
                {(isOwn || isPlatformAdmin) && (
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-500 transition-all flex-shrink-0"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            maxLength={500}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
