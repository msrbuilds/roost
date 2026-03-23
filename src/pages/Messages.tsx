import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ConversationList from '../components/messages/ConversationList';
import ChatView from '../components/messages/ChatView';
import EmptyChatState from '../components/messages/EmptyChatState';
import NewMessageModal from '../components/messages/NewMessageModal';
import type { Conversation } from '../services/message';
import type { Profile } from '../types/database';
import { supabase } from '../services/supabase';

export default function Messages() {
  const { userId } = useParams<{ userId?: string }>();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  // Handle window resize for mobile responsiveness
  useState(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Load conversation from URL parameter
  useEffect(() => {
    if (!userId) return;

    const loadUserConversation = async () => {
      try {
        // Fetch the user's profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, is_online, last_seen_at, membership_type')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          console.error('Error loading user profile:', error);
          return;
        }

        // Create a conversation object
        const conversation: Conversation = {
          otherUser: profile,
          lastMessage: {
            id: '',
            sender_id: '',
            recipient_id: '',
            content: '',
            is_read: false,
            read_at: null,
            created_at: new Date().toISOString(),
            sender: {
              id: (profile as any)?.id,
              username: (profile as any)?.username,
              display_name: (profile as any)?.display_name,
              avatar_url: (profile as any)?.avatar_url,
              is_online: (profile as any)?.is_online,
              membership_type: (profile as any)?.membership_type
            }
          },
          unreadCount: 0,
          lastMessageAt: new Date().toISOString()
        };

        setSelectedConversation(conversation);
      } catch (err) {
        console.error('Error loading conversation:', err);
      }
    };

    loadUserConversation();
  }, [userId]);

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const handleNewUserSelect = (user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>) => {
    // Create a temporary conversation object for the selected user
    const newConversation: Conversation = {
      otherUser: {
        ...user,
        last_seen_at: new Date().toISOString()
      },
      lastMessage: {
        id: '',
        sender_id: '',
        recipient_id: '',
        content: '',
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          is_online: user.is_online,
          membership_type: user.membership_type
        }
      },
      unreadCount: 0,
      lastMessageAt: new Date().toISOString()
    };

    setSelectedConversation(newConversation);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversation list - hide on mobile when chat is selected */}
      <div className={`${isMobileView && selectedConversation ? 'hidden' : 'block'} w-full md:w-80 lg:w-96 flex-shrink-0`}>
        <ConversationList
          onConversationSelect={handleConversationSelect}
          selectedConversationId={selectedConversation?.otherUser.id || null}
          onNewMessage={() => setShowNewMessageModal(true)}
        />
      </div>

      {/* Chat view - hide on mobile when no conversation selected */}
      <div className={`${isMobileView && !selectedConversation ? 'hidden' : 'flex-1'} flex-1`}>
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            onBack={isMobileView ? handleBack : undefined}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* New message modal */}
      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onUserSelect={handleNewUserSelect}
      />
    </div>
  );
}
