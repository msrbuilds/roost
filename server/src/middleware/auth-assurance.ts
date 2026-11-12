import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

function tokenAal(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { aal?: string };
    return payload.aal || 'aal1';
  } catch {
    return 'aal1';
  }
}

export async function enforceAccountStatus(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/auth/mfa/status' || req.path === '/health') return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  const token = header.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_banned, ban_expires_at, two_factor_enabled')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile) return res.status(403).json({ error: 'Account profile is unavailable' });

  const banActive = profile.is_banned && (!profile.ban_expires_at || new Date(profile.ban_expires_at) > new Date());
  if (banActive) return res.status(403).json({ error: 'Account is suspended', code: 'ACCOUNT_BANNED' });
  if (profile.two_factor_enabled && tokenAal(token) !== 'aal2') {
    return res.status(403).json({ error: 'Two-factor verification required', code: 'MFA_REQUIRED' });
  }
  return next();
}
