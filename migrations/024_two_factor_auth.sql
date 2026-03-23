-- Two-Factor Authentication (2FA) Support
-- Add 2FA fields to profiles table and create backup codes table

-- Add 2FA fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ;

-- Create backup codes table for 2FA recovery
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_user_id ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_code_hash ON two_factor_backup_codes(code_hash);

-- RLS Policies for backup codes
ALTER TABLE two_factor_backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own backup codes
CREATE POLICY "Users can view own backup codes"
    ON two_factor_backup_codes FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own backup codes
CREATE POLICY "Users can insert own backup codes"
    ON two_factor_backup_codes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own backup codes (mark as used)
CREATE POLICY "Users can update own backup codes"
    ON two_factor_backup_codes FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can only delete their own backup codes
CREATE POLICY "Users can delete own backup codes"
    ON two_factor_backup_codes FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN profiles.two_factor_secret IS 'Encrypted TOTP secret for 2FA (stored encrypted)';
COMMENT ON COLUMN profiles.two_factor_verified_at IS 'When 2FA was first verified/enabled';
COMMENT ON TABLE two_factor_backup_codes IS 'Backup codes for 2FA recovery - each code can only be used once';
