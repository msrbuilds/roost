// ============================================================
// Roost - Supabase Auth Adapter
// Wraps @supabase/supabase-js auth for the AuthAdapter interface
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthAdapter,
  AuthUser,
  AuthSession,
  AuthResult,
  AuthError,
  AuthStateChangeCallback,
} from '../../interfaces';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapUser(supaUser: any): AuthUser | null {
  if (!supaUser) return null;
  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    email_confirmed_at: supaUser.email_confirmed_at ?? null,
    created_at: supaUser.created_at ?? '',
    updated_at: supaUser.updated_at ?? '',
    user_metadata: supaUser.user_metadata,
  };
}

function mapSession(supaSession: any): AuthSession | null {
  if (!supaSession) return null;
  return {
    access_token: supaSession.access_token,
    refresh_token: supaSession.refresh_token,
    expires_at: supaSession.expires_at ?? 0,
    user: mapUser(supaSession.user)!,
  };
}

function mapError(err: any): AuthError | null {
  if (!err) return null;
  return {
    message: err.message ?? 'Unknown error',
    code: err.code,
    status: err.status,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SupabaseAuthAdapter implements AuthAdapter {
  private supabase: SupabaseClient;

  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      );
    }

    this.supabase = createClient(url, key);
  }

  // ---- Session -----------------------------------------------------------

  async getSession(): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.getSession();
    return {
      user: mapUser(data.session?.user ?? null),
      session: mapSession(data.session),
      error: mapError(error),
    };
  }

  async getUser(): Promise<{ user: AuthUser | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.getUser();
    return {
      user: mapUser(data.user),
      error: mapError(error),
    };
  }

  onAuthStateChange(callback: AuthStateChangeCallback): { unsubscribe: () => void } {
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
      const mappedEvent = event as
        | 'SIGNED_IN'
        | 'SIGNED_OUT'
        | 'TOKEN_REFRESHED'
        | 'USER_UPDATED'
        | 'PASSWORD_RECOVERY';
      callback(mappedEvent, mapSession(session));
    });

    return { unsubscribe: () => data.subscription.unsubscribe() };
  }

  // ---- Sign Up / Sign In -------------------------------------------------

  async signUp(
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        ...(metadata ? { data: metadata } : {}),
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    return {
      user: mapUser(data.user),
      session: mapSession(data.session),
      error: mapError(error),
    };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return {
      user: mapUser(data.user),
      session: mapSession(data.session),
      error: mapError(error),
    };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signOut();
    return { error: mapError(error) };
  }

  // ---- Password ----------------------------------------------------------

  async resetPasswordForEmail(
    email: string,
    redirectTo?: string,
  ): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: mapError(error) };
  }

  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    return { error: mapError(error) };
  }

  // ---- User Management ---------------------------------------------------

  async updateUser(data: {
    email?: string;
    password?: string;
    data?: Record<string, unknown>;
  }): Promise<AuthResult> {
    const { data: result, error } = await this.supabase.auth.updateUser(data);
    return {
      user: mapUser(result.user),
      session: null,
      error: mapError(error),
    };
  }
}
