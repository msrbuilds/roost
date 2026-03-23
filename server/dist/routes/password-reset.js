"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
// Request password reset schema
const requestResetSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
// Reset password schema
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
// Validate token schema
const validateTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
});
// Verify current password schema (for logged-in user changing password)
const verifyPasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
});
// Change password schema (for logged-in user)
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
/**
 * Generate a secure random token
 */
function generateToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
/**
 * Hash a token for storage
 */
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
/**
 * POST /api/auth/request-reset
 * Request a password reset email
 */
router.post('/request-reset', async (req, res) => {
    try {
        // Validate request body
        const validation = requestResetSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.errors,
            });
        }
        const { email } = validation.data;
        const normalizedEmail = email.toLowerCase().trim();
        // Find user by email using the database function
        // This is more efficient than listUsers() which has pagination limits
        const { data: authUser, error: authError } = await supabase_1.supabaseAdmin
            .rpc('get_user_id_by_email', { user_email: normalizedEmail })
            .single();
        if (authError || !authUser) {
            // Don't reveal if email exists - always return success
            console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
            return res.json({
                success: true,
                message: 'If an account exists with this email, a reset link has been sent.',
            });
        }
        const userId = authUser.id;
        // Get user's display name from profile
        const { data: profile } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('display_name, username')
            .eq('id', userId)
            .single();
        const displayName = profile?.display_name || profile?.username || 'there';
        // Invalidate any existing tokens for this user
        await supabase_1.supabaseAdmin
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', userId);
        // Generate new token
        const token = generateToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        // Store token hash in database
        const { error: insertError } = await supabase_1.supabaseAdmin
            .from('password_reset_tokens')
            .insert({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
        });
        if (insertError) {
            console.error('Error storing reset token:', insertError);
            return res.status(500).json({
                error: 'Failed to create reset token',
            });
        }
        // Build reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
        // Send email
        const emailSent = await email_1.emailService.sendPasswordResetEmail({
            email: normalizedEmail,
            name: displayName,
            resetUrl,
        });
        if (!emailSent) {
            console.error('Failed to send password reset email to:', normalizedEmail);
            // Still return success to not reveal if email exists
        }
        else {
            console.log(`Password reset email sent to: ${normalizedEmail}`);
        }
        return res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent.',
        });
    }
    catch (error) {
        console.error('Error in request-reset:', error);
        return res.status(500).json({
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/auth/validate-token
 * Validate a password reset token
 */
router.post('/validate-token', async (req, res) => {
    try {
        // Validate request body
        const validation = validateTokenSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                valid: false,
                error: 'Invalid token format',
            });
        }
        const { token } = validation.data;
        const tokenHash = hashToken(token);
        // Look up token
        const { data: tokenData, error: tokenError } = await supabase_1.supabaseAdmin
            .from('password_reset_tokens')
            .select('*')
            .eq('token_hash', tokenHash)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();
        if (tokenError || !tokenData) {
            return res.json({
                valid: false,
                error: 'Invalid or expired reset link',
            });
        }
        return res.json({
            valid: true,
        });
    }
    catch (error) {
        console.error('Error in validate-token:', error);
        return res.status(500).json({
            valid: false,
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
    try {
        // Validate request body
        const validation = resetPasswordSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.errors,
            });
        }
        const { token, password } = validation.data;
        const tokenHash = hashToken(token);
        // Look up token
        const { data: tokenData, error: tokenError } = await supabase_1.supabaseAdmin
            .from('password_reset_tokens')
            .select('*')
            .eq('token_hash', tokenHash)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();
        if (tokenError || !tokenData) {
            return res.status(400).json({
                error: 'Invalid or expired reset link. Please request a new one.',
            });
        }
        // Update user's password using admin API
        // Also confirm email since they verified ownership via email reset link
        const { error: updateError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(tokenData.user_id, {
            password,
            email_confirm: true
        });
        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({
                error: 'Failed to update password. Please try again.',
            });
        }
        // Mark token as used
        await supabase_1.supabaseAdmin
            .from('password_reset_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', tokenData.id);
        console.log(`Password reset successful for user: ${tokenData.user_id}`);
        return res.json({
            success: true,
            message: 'Password has been reset successfully.',
        });
    }
    catch (error) {
        console.error('Error in reset-password:', error);
        return res.status(500).json({
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/auth/verify-password
 * Verify current password for logged-in user (used before password change)
 * Requires Authorization header with Bearer token
 */
router.post('/verify-password', async (req, res) => {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }
        const token = authHeader.substring(7);
        // Validate request body
        const validation = verifyPasswordSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.errors,
            });
        }
        const { currentPassword } = validation.data;
        // Get user from token
        const { data: { user }, error: userError } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({
                error: 'Invalid or expired session',
            });
        }
        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });
        if (signInError) {
            return res.status(400).json({
                error: 'Current password is incorrect',
            });
        }
        return res.json({
            success: true,
            message: 'Password verified',
        });
    }
    catch (error) {
        console.error('Error in verify-password:', error);
        return res.status(500).json({
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/auth/change-password
 * Change password for logged-in user
 * Requires Authorization header with Bearer token
 */
router.post('/change-password', async (req, res) => {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }
        const token = authHeader.substring(7);
        // Validate request body
        const validation = changePasswordSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.errors,
            });
        }
        const { currentPassword, newPassword } = validation.data;
        // Get user from token
        const { data: { user }, error: userError } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({
                error: 'Invalid or expired session',
            });
        }
        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });
        if (signInError) {
            return res.status(400).json({
                error: 'Current password is incorrect',
            });
        }
        // Update password using admin API
        const { error: updateError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({
                error: 'Failed to update password. Please try again.',
            });
        }
        console.log(`Password changed successfully for user: ${user.id}`);
        return res.json({
            success: true,
            message: 'Password has been changed successfully.',
        });
    }
    catch (error) {
        console.error('Error in change-password:', error);
        return res.status(500).json({
            error: 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=password-reset.js.map