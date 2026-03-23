// ============================================================
// Roost - Auth Adapter Interface
// All auth backends must implement this interface
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

export interface AuthResult {
  user: AuthUser | null;
  session: AuthSession | null;
  error: AuthError | null;
}

export interface AuthError {
  message: string;
  code?: string;
  status?: number;
}

export type AuthStateChangeCallback = (
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY',
  session: AuthSession | null
) => void;

export interface AuthAdapter {
  // --- Session ---
  getSession(): Promise<AuthResult>;
  getUser(): Promise<{ user: AuthUser | null; error: AuthError | null }>;
  onAuthStateChange(callback: AuthStateChangeCallback): { unsubscribe: () => void };

  // --- Sign Up / Sign In ---
  signUp(email: string, password: string, metadata?: Record<string, unknown>): Promise<AuthResult>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<{ error: AuthError | null }>;

  // --- Password ---
  resetPasswordForEmail(email: string, redirectTo?: string): Promise<{ error: AuthError | null }>;
  updatePassword(newPassword: string): Promise<{ error: AuthError | null }>;

  // --- User Management ---
  updateUser(data: { email?: string; password?: string; data?: Record<string, unknown> }): Promise<AuthResult>;

  // --- Admin (server-side) ---
  adminCreateUser?(email: string, password: string, metadata?: Record<string, unknown>): Promise<AuthResult>;
  adminDeleteUser?(userId: string): Promise<{ error: AuthError | null }>;
  adminListUsers?(options?: { page?: number; perPage?: number }): Promise<{ users: AuthUser[]; error: AuthError | null }>;
}
