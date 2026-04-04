-- =============================================================================
-- Supabase Internal Roles, Schemas & Configuration
-- =============================================================================
-- This script runs BEFORE schema.sql on first database initialization.
-- It creates everything Supabase services need to start cleanly.
-- =============================================================================

-- Use the superuser password for all service roles
\set pgpass `echo "$POSTGRES_PASSWORD"`

-- =============================================================================
-- 1. Create service roles
-- =============================================================================
SELECT format('CREATE ROLE supabase_auth_admin LOGIN PASSWORD %L INHERIT;', :'pgpass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') \gexec
SELECT format('CREATE ROLE supabase_storage_admin LOGIN PASSWORD %L INHERIT CREATEDB;', :'pgpass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') \gexec
SELECT format('CREATE ROLE supabase_admin LOGIN PASSWORD %L SUPERUSER CREATEDB CREATEROLE;', :'pgpass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') \gexec
SELECT format('CREATE ROLE authenticator LOGIN PASSWORD %L NOINHERIT;', :'pgpass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') \gexec
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure service-role passwords are always aligned with POSTGRES_PASSWORD,
-- even if roles already existed before this script ran.
ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD :'pgpass' INHERIT;
ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD :'pgpass' INHERIT CREATEDB;
ALTER ROLE supabase_admin WITH LOGIN PASSWORD :'pgpass' SUPERUSER CREATEDB CREATEROLE;
ALTER ROLE authenticator WITH LOGIN PASSWORD :'pgpass' NOINHERIT;
ALTER ROLE service_role WITH NOLOGIN BYPASSRLS;

-- =============================================================================
-- 2. Grant role memberships
-- =============================================================================
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_auth_admin TO postgres;
GRANT supabase_storage_admin TO postgres;

-- Ensure service roles can connect and create objects as required by migrations.
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_auth_admin;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_storage_admin;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO authenticator;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_admin;

-- =============================================================================
-- 3. Create schemas
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT CREATE ON SCHEMA storage TO supabase_storage_admin;

CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;
GRANT USAGE, CREATE ON SCHEMA _realtime TO supabase_admin;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- =============================================================================
-- 4. Install extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- =============================================================================
-- 5. Grant schema permissions
-- =============================================================================
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT ALL ON SCHEMA public TO supabase_admin;
GRANT ALL ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT USAGE ON SCHEMA storage TO service_role;

-- Explicit CREATE grants for migration tooling that creates schema_migrations.
GRANT CREATE ON SCHEMA public TO supabase_auth_admin;
GRANT CREATE ON SCHEMA public TO supabase_storage_admin;
GRANT CREATE ON SCHEMA public TO supabase_admin;

GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA storage TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

-- =============================================================================
-- 6. Set database search path
-- =============================================================================
-- GoTrue queries auth tables without schema prefix (e.g. "identities" not "auth.identities")
-- This search_path ensures those queries resolve correctly.
ALTER DATABASE postgres SET search_path TO public, auth, extensions;

-- Role-level defaults to avoid "no schema selected to create in" during migrations.
ALTER ROLE supabase_auth_admin SET search_path TO public, auth, extensions;
ALTER ROLE supabase_storage_admin SET search_path TO storage, public, extensions;
ALTER ROLE supabase_admin SET search_path TO _realtime, public, auth, extensions;
ALTER ROLE authenticator SET search_path TO public, auth, extensions;

-- =============================================================================
-- 7. Create auth types for GoTrue
-- =============================================================================
-- GoTrue v2.172+ add_mfa_phone_config migration tries ALTER TYPE auth.factor_type
-- but the add_mfa_schema migration that creates it sometimes fails silently.
-- Pre-creating with ('totp', 'webauthn') lets GoTrue's migration add 'phone' itself.
DO $$ BEGIN
  CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;
ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

-- =============================================================================
-- 8. Create auth.uid() function
-- =============================================================================
-- Required by RLS policies in schema.sql. GoTrue also creates this, but
-- schema.sql runs before GoTrue starts, so we need it here.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
  )::text
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.email', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  )::text
$$;

-- =============================================================================
-- 9. Create auth.users stub table
-- =============================================================================
-- schema.sql has FK references to auth.users. GoTrue will ALTER this table
-- during its own migrations, but we need the basic structure for schema.sql
-- to create profiles with the FK constraint.
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL PRIMARY KEY,
  aud varchar(255),
  role varchar(255),
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text UNIQUE DEFAULT NULL,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false
);

ALTER TABLE auth.users OWNER TO supabase_auth_admin;

-- =============================================================================
-- 10. Create supabase_realtime publication
-- =============================================================================
-- Required by the Realtime service for CDC (Change Data Capture).
-- Tables are added to this publication as needed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- =============================================================================
-- Done! Database is ready for schema.sql and Supabase services.
-- =============================================================================
