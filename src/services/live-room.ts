import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// --- Types ---

export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  youtube_embed_url: string | null;
  scheduled_at: string | null;
  visibility: 'unlisted' | 'private';
  status: 'idle' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export interface LiveStatus {
  isLive: boolean;
  session: {
    id: string;
    title: string;
    description: string | null;
    started_at: string;
  } | null;
  playerUrl: string | null;
  visibility: 'unlisted' | 'private' | null;
}

export interface Recording {
  id: string;
  title: string;
  description: string | null;
  started_at: string | null;
  ended_at: string | null;
  playerUrl: string | null;
  visibility: 'unlisted' | 'private';
}

export interface UpcomingSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  created_at: string;
}

export interface RsvpInfo {
  hasRsvp: boolean;
  rsvp: { id: string; created_at: string } | null;
}

export interface RsvpEntry {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

// --- Auth helper ---

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// --- Premium user service ---

export const liveRoomService = {
  async getStatus(): Promise<LiveStatus> {
    const response = await authFetch('/api/live-room/status');
    if (!response.ok) throw new Error('Failed to get live status');
    return response.json();
  },

  async getRecordings(): Promise<Recording[]> {
    const response = await authFetch('/api/live-room/recordings');
    if (!response.ok) throw new Error('Failed to get recordings');
    const data = await response.json();
    return data.recordings;
  },

  async getUpcoming(): Promise<UpcomingSession[]> {
    const response = await authFetch('/api/live-room/upcoming');
    if (!response.ok) throw new Error('Failed to get upcoming sessions');
    const data = await response.json();
    return data.sessions;
  },

  async rsvp(sessionId: string): Promise<void> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}/rsvp`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to RSVP');
    }
  },

  async cancelRsvp(sessionId: string): Promise<void> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}/rsvp`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to cancel RSVP');
  },

  async getRsvpStatus(sessionId: string): Promise<RsvpInfo> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}/rsvp`);
    if (!response.ok) throw new Error('Failed to check RSVP');
    return response.json();
  },
};

// --- Admin service ---

export const liveRoomAdminService = {
  async createSession(params: {
    title: string;
    description?: string;
    youtube_embed_url?: string;
    scheduled_at?: string;
    visibility?: 'unlisted' | 'private';
  }): Promise<{ session: LiveSession }> {
    const response = await authFetch('/api/live-room/sessions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create session');
    }
    return response.json();
  },

  async updateSession(sessionId: string, updates: {
    status?: 'idle' | 'live' | 'ended';
    title?: string;
    description?: string;
    youtube_embed_url?: string;
    scheduled_at?: string;
    visibility?: 'unlisted' | 'private';
  }): Promise<LiveSession> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update session');
    const data = await response.json();
    return data.session;
  },

  async deleteSession(sessionId: string): Promise<void> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete session');
  },

  async listSessions(): Promise<LiveSession[]> {
    const response = await authFetch('/api/live-room/sessions');
    if (!response.ok) throw new Error('Failed to list sessions');
    const data = await response.json();
    return data.sessions;
  },

  async getRsvpList(sessionId: string): Promise<RsvpEntry[]> {
    const response = await authFetch(`/api/live-room/sessions/${sessionId}/rsvp-list`);
    if (!response.ok) throw new Error('Failed to get RSVP list');
    const data = await response.json();
    return data.rsvps;
  },
};
