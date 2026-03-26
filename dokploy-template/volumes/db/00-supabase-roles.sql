-- =============================================================================
-- Supabase Internal Roles & Schemas
-- =============================================================================
-- This script runs BEFORE schema.sql on first database initialization.
-- It creates all roles and schemas that Supabase services expect.
-- The password for all roles is set to POSTGRES_PASSWORD (passed via env).
-- =============================================================================

-- Use the superuser password for all service roles
-- PostgreSQL makes POSTGRES_PASSWORD available during init
\set pgpass `echo "$POSTGRES_PASSWORD"`

-- =============================================================================
-- 1. Create service roles
-- =============================================================================

-- Auth service role (used by GoTrue)
DO $$ BEGIN
  CREATE ROLE supabase_auth_admin LOGIN PASSWORD :'pgpass' INHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage service role
DO $$ BEGIN
  CREATE ROLE supabase_storage_admin LOGIN PASSWORD :'pgpass' INHERIT CREATEDB;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin role (used by Realtime, Meta)
DO $$ BEGIN
  CREATE ROLE supabase_admin LOGIN PASSWORD :'pgpass' SUPERUSER CREATEDB CREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticator role (used by PostgREST)
DO $$ BEGIN
  CREATE ROLE authenticator LOGIN PASSWORD :'pgpass' NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anonymous role (for unauthenticated API requests)
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated role (for authenticated API requests)
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role (for server-side API requests)
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Grant role memberships
-- =============================================================================
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_auth_admin TO postgres;
GRANT supabase_storage_admin TO postgres;

-- =============================================================================
-- 3. Create schemas
-- =============================================================================

-- Auth schema (owned by supabase_auth_admin for GoTrue migrations)
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Storage schema
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;

-- Realtime schema
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;

-- Extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- =============================================================================
-- 4. Grant schema permissions
-- =============================================================================

-- Public schema access
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT ALL ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Table/sequence grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_storage_admin;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

-- =============================================================================
-- 5. Create auth types needed by GoTrue migrations
-- =============================================================================
-- GoTrue v2.172+ expects these types to exist before its own migrations run.
-- Without them, the add_mfa_phone_config migration fails.

DO $$ BEGIN
  CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure auth types are owned by supabase_auth_admin
ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;
ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

-- =============================================================================
-- Done! Supabase services can now connect and run their own migrations.
-- =============================================================================
