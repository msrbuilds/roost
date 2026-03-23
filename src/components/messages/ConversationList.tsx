import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, MessageSquareOff } from 'lucide-react';
import { getConversations } from '../../services/message';
import { supabase } from '../../services/supabase';
import type { Conversation } from '../../services/message';
import { useAuth } from '../../contexts/AuthContext';
import ConversationItem from './ConversationItem';

interface ConversationListProps {
  onConversationSelect: (conversation: Conversation) => void;
  selectedConversationId: string | null;
  onNewMessage: () => void;
}

export default function ConversationList({
  onConversationSelect,
  selectedConversationId,
  onNewMessage
}: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (!user) return;

    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await getConversations(user.id);
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Real-time subscription for new/updated messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-messages-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, async () => {
        // Reload conversations when new message arrives
        await loadConversations(false); // false = no loading spinner
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, () => {
        // Reload on read receipt updates
        loadConversations(false);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, async () => {
        // Also reload when user sends message from another tab
        await loadConversations(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 p-4">
        <MessageSquareOff className="w-12 h-12 text-error mb-2" />
        <p className="text-sm text-error text-center">{error}</p>
        <button
          onClick={() => loadConversations()}
          className="btn btn-secondary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Messages</h2>
        <button
          onClick={onNewMessage}
          className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          title="New message"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <MessageSquareOff className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">No conversations yet</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mb-4">
              Start a new conversation to begin chatting
            </p>
            <button onClick={onNewMessage} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              New Message
            </button>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.otherUser.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.otherUser.id}
              onClick={() => onConversationSelect(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
}
