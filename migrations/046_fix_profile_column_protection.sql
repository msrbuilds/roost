-- =============================================================================
-- Migration 046: Fix Profile Column Protection (CRITICAL SECURITY FIX)
-- =============================================================================
--
-- PROBLEM: Migration 030 accidentally replaced check_role_change() with an
-- unrelated group_members function, removing ALL role-change protection.
-- This allowed any authenticated user to promote themselves to superadmin
-- by calling: supabase.from('profiles').update({ role: 'superadmin' })
--
-- FIX: Restore and expand the trigger to protect ALL sensitive columns:
--   - role (was protected before 030 broke it)
--   - is_banned, ban_reason, ban_expires_at, banned_by, banned_at
--   - membership_type
--   - two_factor_secret, two_factor_verified_at
--
-- =============================================================================

-- Step 1: Drop the broken trigger and function
DROP TRIGGER IF EXISTS enforce_role_change ON profiles;
DROP FUNCTION IF EXISTS public.check_role_change();

-- Step 2: Create comprehensive protection function
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Allow service_role operations (backend/admin API calls where auth.uid() is NULL)
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Platform admins and superadmins can modify sensitive columns
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    ) THEN
        -- Admins can modify ban/membership columns but NOT role
        -- Only superadmins can change roles
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role = 'superadmin'
            ) THEN
                RAISE EXCEPTION 'Only superadmins can change user roles';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Regular users: block ALL sensitive column changes

    -- Role protection
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Only superadmins can change user roles';
    END IF;

    -- Ban status protection
    IF OLD.is_banned IS DISTINCT FROM NEW.is_banned
       OR OLD.ban_reason IS DISTINCT FROM NEW.ban_reason
       OR OLD.ban_expires_at IS DISTINCT FROM NEW.ban_expires_at
       OR OLD.banned_by IS DISTINCT FROM NEW.banned_by
       OR OLD.banned_at IS DISTINCT FROM NEW.banned_at THEN
        RAISE EXCEPTION 'Only admins can modify ban status';
    END IF;

    -- Membership protection
    IF OLD.membership_type IS DISTINCT FROM NEW.membership_type THEN
        RAISE EXCEPTION 'Membership type cannot be changed directly';
    END IF;

    -- 2FA secret protection (users can toggle two_factor_enabled, but not modify secrets directly)
    IF OLD.two_factor_secret IS DISTINCT FROM NEW.two_factor_secret
       OR OLD.two_factor_verified_at IS DISTINCT FROM NEW.two_factor_verified_at THEN
        RAISE EXCEPTION '2FA secrets can only be modified through the verification flow';
    END IF;

    RETURN NEW;
END;
$$;

-- Step 3: Attach trigger to profiles table
CREATE TRIGGER protect_profile_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- Step 4: Verify the trigger exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'protect_profile_columns'
        AND event_object_table = 'profiles'
    ) THEN
        RAISE EXCEPTION 'CRITICAL: protect_profile_columns trigger was not created!';
    END IF;
    RAISE NOTICE 'Migration 046: Profile column protection trigger created successfully';
    RAISE NOTICE 'Protected columns: role, is_banned, ban_*, membership_type, two_factor_secret/verified_at';
END;
$$;
