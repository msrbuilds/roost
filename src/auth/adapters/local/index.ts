// ============================================================
// Roost - Local JWT Auth Adapter (for MongoDB backend)
// Talks to the Express API for all auth operations and stores
// the JWT in localStorage.
// ============================================================

import type {
  AuthAdapter,
  AuthUser,
  AuthSession,
  AuthResult,
  AuthError,
  AuthStateChangeCallback,
} from '../../interfaces';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'roost_auth_token';
const REFRESH_TOKEN_KEY = 'roost_refresh_token';

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

interface JwtPayload {
  sub: string; // user id
  email: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  iat: number;
  exp: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JwtPayload): boolean {
  // exp is in seconds
  return Date.now() >= payload.exp * 1000;
}

function payloadToUser(payload: JwtPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    email_confirmed_at: payload.email_confirmed_at ?? null,
    created_at: new Date(payload.iat * 1000).toISOString(),
    updated_at: new Date(payload.iat * 1000).toISOString(),
    user_metadata: payload.user_metadata,
  };
}

function tokenToSession(token: string, payload: JwtPayload): AuthSession {
  return {
    access_token: token,
    refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY) || '',
    expires_at: payload.exp,
    user: payloadToUser(payload),
  };
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

interface ApiResponse {
  ok: boolean;
  status: number;
  data: any;
}

async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    auth?: boolean;
  } = {},
): Promise<ApiResponse> {
  const { method = 'POST', body, auth = false } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: { message: err.message || 'Network error' },
    };
  }
}

function toError(res: ApiResponse): AuthError | null {
  if (res.ok) return null;
  return {
    message: res.data?.message || res.data?.error || 'Request failed',
    code: res.data?.code,
    status: res.status,
  };
}

// ---------------------------------------------------------------------------
// Simple event-emitter for auth state changes
// ---------------------------------------------------------------------------

type Listener = AuthStateChangeCallback;

class AuthEventEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(fn: Listener): { unsubscribe: () => void } {
    this.listeners.add(fn);
    return {
      unsubscribe: () => {
        this.listeners.delete(fn);
      },
    };
  }

  emit(
    event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY',
    session: AuthSession | null,
  ) {
    for (const fn of this.listeners) {
      try {
        fn(event, session);
      } catch {
        // Swallow listener errors so one bad callback doesn't break others
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LocalAuthAdapter implements AuthAdapter {
  private emitter = new AuthEventEmitter();
  private storageListener: ((e: StorageEvent) => void) | null = null;

  constructor() {
    // Listen for token changes from other tabs
    this.storageListener = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY) return;

      if (e.newValue) {
        const payload = decodeJwt(e.newValue);
        if (payload && !isTokenExpired(payload)) {
          this.emitter.emit('SIGNED_IN', tokenToSession(e.newValue, payload));
        }
      } else {
        this.emitter.emit('SIGNED_OUT', null);
      }
    };

    window.addEventListener('storage', this.storageListener);
  }

  // ---- helpers -----------------------------------------------------------

  private storeTokens(data: any): void {
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
  }

  private clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private currentSession(): AuthSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    const payload = decodeJwt(token);
    if (!payload || isTokenExpired(payload)) return null;

    return tokenToSession(token, payload);
  }

  // ---- Session -----------------------------------------------------------

  async getSession(): Promise<AuthResult> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { user: null, session: null, error: null };
    }

    const payload = decodeJwt(token);
    if (!payload) {
      this.clearTokens();
      return { user: null, session: null, error: { message: 'Invalid token' } };
    }

    if (isTokenExpired(payload)) {
      this.clearTokens();
      return { user: null, session: null, error: { message: 'Token expired' } };
    }

    const session = tokenToSession(token, payload);
    return { user: session.user, session, error: null };
  }

  async getUser(): Promise<{ user: AuthUser | null; error: AuthError | null }> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { user: null, error: null };
    }

    const payload = decodeJwt(token);
    if (!payload || isTokenExpired(payload)) {
      return { user: null, error: { message: 'Invalid or expired token' } };
    }

    return { user: payloadToUser(payload), error: null };
  }

  onAuthStateChange(callback: AuthStateChangeCallback): { unsubscribe: () => void } {
    // Fire initial state immediately if there is a valid session
    const session = this.currentSession();
    if (session) {
      // Use queueMicrotask so the subscriber has time to set up before the callback fires
      queueMicrotask(() => callback('SIGNED_IN', session));
    }

    return this.emitter.subscribe(callback);
  }

  // ---- Sign Up / Sign In -------------------------------------------------

  async signUp(
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuthResult> {
    const res = await apiCall('/api/auth/signup', {
      body: { email, password, metadata },
    });

    if (!res.ok) {
      return { user: null, session: null, error: toError(res)! };
    }

    this.storeTokens(res.data);

    const session = this.currentSession();
    if (session) {
      this.emitter.emit('SIGNED_IN', session);
    }

    return { user: session?.user ?? null, session, error: null };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const res = await apiCall('/api/auth/login', {
      body: { email, password },
    });

    if (!res.ok) {
      return { user: null, session: null, error: toError(res)! };
    }

    this.storeTokens(res.data);

    const session = this.currentSession();
    if (session) {
      this.emitter.emit('SIGNED_IN', session);
    }

    return { user: session?.user ?? null, session, error: null };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    // Best-effort server call; we clear locally regardless
    await apiCall('/api/auth/logout', { auth: true }).catch(() => {});

    this.clearTokens();
    this.emitter.emit('SIGNED_OUT', null);

    return { error: null };
  }

  // ---- Password ----------------------------------------------------------

  async resetPasswordForEmail(
    email: string,
    _redirectTo?: string,
  ): Promise<{ error: AuthError | null }> {
    const res = await apiCall('/api/auth/reset-password', {
      body: { email },
    });
    return { error: toError(res) };
  }

  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const res = await apiCall('/api/auth/update-password', {
      body: { password: newPassword },
      auth: true,
    });

    if (res.ok && res.data.access_token) {
      this.storeTokens(res.data);
      const session = this.currentSession();
      if (session) {
        this.emitter.emit('TOKEN_REFRESHED', session);
      }
    }

    return { error: toError(res) };
  }

  // ---- User Management ---------------------------------------------------

  async updateUser(data: {
    email?: string;
    password?: string;
    data?: Record<string, unknown>;
  }): Promise<AuthResult> {
    const res = await apiCall('/api/auth/update-user', {
      body: data,
      auth: true,
    });

    if (!res.ok) {
      return { user: null, session: null, error: toError(res)! };
    }

    // If the server returns a fresh token, store it
    if (res.data.access_token) {
      this.storeTokens(res.data);
    }

    const session = this.currentSession();
    if (session) {
      this.emitter.emit('USER_UPDATED', session);
    }

    return { user: session?.user ?? null, session, error: null };
  }
}
