import { supabase } from './supabase';

export interface LiveChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

export async function getMessages(
  sessionId: string,
  limit = 50,
  before?: string
): Promise<LiveChatMessage[]> {
  let query = supabase
    .from('live_session_messages')
    .select('id, session_id, user_id, content, created_at, profiles:user_id(display_name, avatar_url)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Results come newest-first from query, reverse to display oldest-first
  return (data as unknown as LiveChatMessage[]).reverse();
}

export async function sendMessage(
  sessionId: string,
  userId: string,
  content: string
): Promise<LiveChatMessage> {
  const { data, error } = await supabase
    .from('live_session_messages')
    .insert({ session_id: sessionId, user_id: userId, content })
    .select('id, session_id, user_id, content, created_at, profiles:user_id(display_name, avatar_url)')
    .single();

  if (error) throw error;
  return data as unknown as LiveChatMessage;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('live_session_messages')
    .delete()
    .eq('id', messageId);

  if (error) throw error;
}
