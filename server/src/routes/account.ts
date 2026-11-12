import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const accountRouter = Router();

function bearerToken(value?: string): string | null {
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

accountRouter.get('/mfa/status', async (req, res) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  const enabled = Boolean(data.user.factors?.some((factor) => factor.factor_type === 'totp' && factor.status === 'verified'));
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ two_factor_enabled: enabled })
    .eq('id', data.user.id);

  if (updateError) {
    console.error('Failed to synchronize MFA status:', updateError);
    return res.status(500).json({ error: 'Could not synchronize two-factor status' });
  }

  return res.json({ enabled });
});

accountRouter.delete('/account', async (req, res) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm account deletion' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('Account deletion failed:', deleteError);
    return res.status(500).json({ error: 'Account deletion failed' });
  }

  return res.status(204).send();
});
