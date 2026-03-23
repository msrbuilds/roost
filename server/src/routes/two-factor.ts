import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import {
  generateSecret,
  generateBackupCodes,
  hashBackupCode,
  verifyTOTP,
  generateOtpauthUri,
} from '../services/two-factor';

const router = Router();

// Setup 2FA schema
const setup2FASchema = z.object({
  // No body needed, just auth token
});

// Verify 2FA schema
const verify2FASchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

// Disable 2FA schema
const disable2FASchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

// Verify backup code schema
const verifyBackupCodeSchema = z.object({
  code: z.string().min(1, 'Backup code is required'),
});

// Check 2FA required for login schema
const check2FARequiredSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Helper to get user from auth header
 */
async function getUserFromAuth(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * POST /api/2fa/check-required
 * Check if 2FA is required for login (validates credentials first)
 * Called before completing sign-in to determine if 2FA step is needed
 */
router.post('/check-required', async (req: Request, res: Response) => {
  try {
    const validation = check2FARequiredSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email, password } = validation.data;

    // Attempt to sign in to verify credentials
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Check if it's an email confirmation error
      if (signInError.message?.toLowerCase().includes('email not confirmed')) {
        return res.status(403).json({
          error: 'Email not confirmed',
          code: 'EMAIL_NOT_CONFIRMED',
          email: email,
        });
      }
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    if (!signInData.user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Get 2FA status from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_enabled')
      .eq('id', signInData.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching 2FA status:', profileError);
      // If we can't check 2FA status, assume it's not required
      return res.json({
        requires2FA: false,
        session: signInData.session,
      });
    }

    const requires2FA = profile?.two_factor_enabled || false;

    if (requires2FA) {
      // Sign out the session we just created - user needs to verify 2FA first
      await supabaseAdmin.auth.admin.signOut(signInData.session.access_token);

      return res.json({
        requires2FA: true,
        userId: signInData.user.id,
        // Don't send session - they need to verify 2FA first
      });
    }

    // No 2FA required, return the session
    return res.json({
      requires2FA: false,
      session: signInData.session,
    });
  } catch (error) {
    console.error('Error in check-required:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/2fa/verify-login
 * Verify 2FA code during login and return session
 */
router.post('/verify-login', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      code: z.string().length(6),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email, password, code } = validation.data;

    // Sign in to get user info
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Get the stored secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', signInData.user.id)
      .single();

    if (profileError || !profile?.two_factor_enabled || !profile?.two_factor_secret) {
      // 2FA not enabled, just return the session
      return res.json({
        success: true,
        session: signInData.session,
      });
    }

    // Verify the 2FA code
    const isValid = verifyTOTP(profile.two_factor_secret, code);

    if (!isValid) {
      // Sign out the session we just created
      await supabaseAdmin.auth.admin.signOut(signInData.session.access_token);

      return res.status(400).json({
        error: 'Invalid verification code',
      });
    }

    // 2FA verified, return the session
    return res.json({
      success: true,
      session: signInData.session,
    });
  } catch (error) {
    console.error('Error in verify-login:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/2fa/verify-login-backup
 * Verify backup code during login and return session
 */
router.post('/verify-login-backup', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      code: z.string().min(1),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email, password, code } = validation.data;

    // Sign in to get user info
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Verify backup code
    const codeHash = hashBackupCode(code);

    const { data: backupCode, error: findError } = await supabaseAdmin
      .from('two_factor_backup_codes')
      .select('id')
      .eq('user_id', signInData.user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .single();

    if (findError || !backupCode) {
      // Sign out the session we just created
      await supabaseAdmin.auth.admin.signOut(signInData.session.access_token);

      return res.status(400).json({
        error: 'Invalid or already used backup code',
      });
    }

    // Mark backup code as used
    await supabaseAdmin
      .from('two_factor_backup_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', backupCode.id);

    console.log(`Backup code used for login by user: ${signInData.user.id}`);

    // Return the session
    return res.json({
      success: true,
      session: signInData.session,
    });
  } catch (error) {
    console.error('Error in verify-login-backup:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/2fa/status
 * Get current 2FA status for the user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get profile with 2FA status
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_enabled, two_factor_verified_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching 2FA status:', error);
      return res.status(500).json({ error: 'Failed to fetch 2FA status' });
    }

    return res.json({
      enabled: profile?.two_factor_enabled || false,
      verifiedAt: profile?.two_factor_verified_at || null,
    });
  } catch (error) {
    console.error('Error in 2FA status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/setup
 * Initialize 2FA setup - generates secret and QR code URI
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if 2FA is already enabled
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_enabled, two_factor_secret')
      .eq('id', user.id)
      .single();

    if (profile?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Generate new secret
    const secret = generateSecret();
    const otpauthUri = generateOtpauthUri(secret, user.email || '', 'Let\'s Vibe It');

    // Store secret (not enabled yet, waiting for verification)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        two_factor_secret: secret,
        two_factor_enabled: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error storing 2FA secret:', updateError);
      return res.status(500).json({ error: 'Failed to setup 2FA' });
    }

    return res.json({
      secret,
      otpauthUri,
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error) {
    console.error('Error in 2FA setup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/verify
 * Verify 2FA code and enable 2FA (completes setup)
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = verify2FASchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { code } = validation.data;

    // Get the stored secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.two_factor_secret) {
      return res.status(400).json({ error: 'Please setup 2FA first' });
    }

    if (profile.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Verify the code
    const isValid = verifyTOTP(profile.two_factor_secret, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Hash and store backup codes
    const backupCodeRecords = backupCodes.map((c) => ({
      user_id: user.id,
      code_hash: hashBackupCode(c),
    }));

    // Delete any existing backup codes
    await supabaseAdmin
      .from('two_factor_backup_codes')
      .delete()
      .eq('user_id', user.id);

    // Insert new backup codes
    const { error: backupError } = await supabaseAdmin
      .from('two_factor_backup_codes')
      .insert(backupCodeRecords);

    if (backupError) {
      console.error('Error storing backup codes:', backupError);
      return res.status(500).json({ error: 'Failed to generate backup codes' });
    }

    // Enable 2FA
    const { error: enableError } = await supabaseAdmin
      .from('profiles')
      .update({
        two_factor_enabled: true,
        two_factor_verified_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (enableError) {
      console.error('Error enabling 2FA:', enableError);
      return res.status(500).json({ error: 'Failed to enable 2FA' });
    }

    console.log(`2FA enabled for user: ${user.id}`);

    return res.json({
      success: true,
      backupCodes,
      message: '2FA has been enabled. Please save your backup codes securely.',
    });
  } catch (error) {
    console.error('Error in 2FA verify:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/disable
 * Disable 2FA for the user
 */
router.post('/disable', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = disable2FASchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { code } = validation.data;

    // Get the stored secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify the code
    const isValid = verifyTOTP(profile.two_factor_secret!, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Disable 2FA and clear secret
    const { error: disableError } = await supabaseAdmin
      .from('profiles')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_verified_at: null,
      })
      .eq('id', user.id);

    if (disableError) {
      console.error('Error disabling 2FA:', disableError);
      return res.status(500).json({ error: 'Failed to disable 2FA' });
    }

    // Delete backup codes
    await supabaseAdmin
      .from('two_factor_backup_codes')
      .delete()
      .eq('user_id', user.id);

    console.log(`2FA disabled for user: ${user.id}`);

    return res.json({
      success: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    console.error('Error in 2FA disable:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/validate
 * Validate a 2FA code during login
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = verify2FASchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { code } = validation.data;

    // Get the stored secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.two_factor_enabled || !profile?.two_factor_secret) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }

    // Verify the code
    const isValid = verifyTOTP(profile.two_factor_secret, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    return res.json({
      success: true,
      message: '2FA code verified',
    });
  } catch (error) {
    console.error('Error in 2FA validate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/backup
 * Verify a backup code and mark it as used
 */
router.post('/backup', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = verifyBackupCodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { code } = validation.data;
    const codeHash = hashBackupCode(code);

    // Find unused backup code
    const { data: backupCode, error: findError } = await supabaseAdmin
      .from('two_factor_backup_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .single();

    if (findError || !backupCode) {
      return res.status(400).json({ error: 'Invalid or already used backup code' });
    }

    // Mark as used
    const { error: updateError } = await supabaseAdmin
      .from('two_factor_backup_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', backupCode.id);

    if (updateError) {
      console.error('Error marking backup code as used:', updateError);
      return res.status(500).json({ error: 'Failed to use backup code' });
    }

    console.log(`Backup code used for user: ${user.id}`);

    return res.json({
      success: true,
      message: 'Backup code verified',
    });
  } catch (error) {
    console.error('Error in backup code verification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/2fa/regenerate-backup
 * Regenerate backup codes (requires valid 2FA code)
 */
router.post('/regenerate-backup', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = verify2FASchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { code } = validation.data;

    // Get the stored secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.two_factor_enabled || !profile?.two_factor_secret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify the code
    const isValid = verifyTOTP(profile.two_factor_secret, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();

    // Delete existing backup codes
    await supabaseAdmin
      .from('two_factor_backup_codes')
      .delete()
      .eq('user_id', user.id);

    // Insert new backup codes
    const backupCodeRecords = backupCodes.map((c) => ({
      user_id: user.id,
      code_hash: hashBackupCode(c),
    }));

    const { error: insertError } = await supabaseAdmin
      .from('two_factor_backup_codes')
      .insert(backupCodeRecords);

    if (insertError) {
      console.error('Error storing new backup codes:', insertError);
      return res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }

    console.log(`Backup codes regenerated for user: ${user.id}`);

    return res.json({
      success: true,
      backupCodes,
      message: 'New backup codes generated. Please save them securely.',
    });
  } catch (error) {
    console.error('Error in regenerate backup codes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
