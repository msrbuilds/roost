// ============================================================
// Roost - Auth Factory
// Returns the correct auth adapter based on the database config
// ============================================================

import { getAuthConfig } from '../db/config';
import type { AuthAdapter } from './interfaces';

let _auth: AuthAdapter | null = null;

export async function getAuth(): Promise<AuthAdapter> {
  if (_auth) return _auth;
  const config = getAuthConfig();
  if (config.provider === 'supabase') {
    const { SupabaseAuthAdapter } = await import('./adapters/supabase');
    _auth = new SupabaseAuthAdapter();
  } else {
    const { LocalAuthAdapter } = await import('./adapters/local');
    _auth = new LocalAuthAdapter();
  }
  return _auth;
}

export function auth(): AuthAdapter {
  if (!_auth) throw new Error('Auth not initialized. Call getAuth() first.');
  return _auth;
}

export type { AuthAdapter, AuthUser, AuthSession, AuthResult, AuthError } from './interfaces';
