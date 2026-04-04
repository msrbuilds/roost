# Dockploy VPS Troubleshooting

Troubleshooting playbook for Roost + self-hosted Supabase on Dockploy.

Use with: [Dockploy (VPS) Deployment Guide](./dockploy-vps.md)

---

## Baseline Variables

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-472jet
DB_CTR="${APP_PREFIX}-db-1"
BACKEND="${APP_PREFIX}-backend-1"
KONG="${APP_PREFIX}-kong-1"
PASS="$(docker inspect "$DB_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"
```

---

## Quick Triage

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$APP_PREFIX"
docker logs --tail=120 ${APP_PREFIX}-auth-1
docker logs --tail=120 ${APP_PREFIX}-rest-1
docker logs --tail=120 ${APP_PREFIX}-kong-1
docker logs --tail=120 ${APP_PREFIX}-backend-1
curl -i https://your-domain.com/api/health
```

---

## Fresh Install Reset (Fastest Recovery)

If first boot was broken (missing keys, partial init), fastest fix is:

1. Keep correct env vars.
2. Stop/remove stack.
3. Delete app DB volume (`db-data`).
4. Redeploy.

---

## Issue: `password authentication failed` for Supabase Roles

Symptoms:
- `password authentication failed for user "supabase_auth_admin"`
- same for `authenticator` or `supabase_storage_admin`

Fix role passwords and grants:

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -v pass="$PASS" <<'SQL'
ALTER ROLE supabase_auth_admin WITH PASSWORD :'pass';
ALTER ROLE authenticator WITH PASSWORD :'pass';
ALTER ROLE supabase_storage_admin WITH PASSWORD :'pass';
ALTER ROLE supabase_admin WITH PASSWORD :'pass';

GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_auth_admin;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO authenticator;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_storage_admin;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE postgres TO supabase_admin;

GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO authenticator;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT ALL ON SCHEMA public TO supabase_admin;

ALTER ROLE supabase_auth_admin SET search_path TO public, auth, extensions;
ALTER ROLE authenticator SET search_path TO public, auth, extensions;
ALTER ROLE supabase_storage_admin SET search_path TO storage, public, extensions;
ALTER ROLE supabase_admin SET search_path TO _realtime, public, auth, extensions;
SQL
```

---

## Issue: `ERROR: type "auth.factor_type" does not exist`

Auth/GoTrue MFA migration dependency issue.

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;

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
SQL


docker restart ${APP_PREFIX}-auth-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-backend-1
```

---

## Issue: `ERROR: must be owner of function uid`

Auth migrations run as `supabase_auth_admin`; ownership mismatch blocks `CREATE OR REPLACE`.

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND p.proname = 'uid'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND p.proname = 'role'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND p.proname = 'email'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;
SQL


docker restart ${APP_PREFIX}-auth-1 ${APP_PREFIX}-rest-1 ${APP_PREFIX}-kong-1
```

---

## Issue: `permission denied for schema public` / `permission denied for database postgres`

Also seen as Realtime migration `no schema has been selected to create in`.

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres <<'SQL'
ALTER ROLE service_role WITH NOLOGIN BYPASSRLS;

GRANT USAGE ON SCHEMA public, auth, storage TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth, storage TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth, storage TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public, auth, storage TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
SQL
```

---

## Issue: `Supabase error: relation "public.profiles" does not exist`

Roost schema not fully applied.

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/99-roost-schema.sql \
  || docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/migrations/99-roost-schema.sql

docker restart ${APP_PREFIX}-backend-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-nginx-1
```

Verify:

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -c "select to_regclass('public.profiles');"
curl -i https://your-domain.com/api/health
```

---

## Issue: `publication "supabase_realtime" does not exist`

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE live_session_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL
```

---

## Issue: `/api/health` is 503 and Kong `/rest/v1` is 403

1. Check Kong template replacement:

```bash
docker exec "$KONG" sh -lc "grep -n '__SUPABASE_.*__' /home/kong/kong.yml || true"
```

2. Compare backend key with key in `kong.yml` (hash only):

```bash
BKEY="$(docker inspect "$BACKEND" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^SUPABASE_SECRET_KEY=//p')"
KONG_FILE_KEY="$(docker exec "$KONG" sh -lc "cat /home/kong/kong.yml" \
  | awk '/username: service_role/{f=1} f&&/key:/{sub(/^ +key: /,""); print; exit}' \
  | tr -d '\r\n')"
printf '%s' "$BKEY" | tr -d '\r\n' | sha256sum
printf '%s' "$KONG_FILE_KEY" | sha256sum
```

3. If mismatch, redeploy/restart Kong and backend.

---

## Issue: Frontend 503 and `name resolution failed`

Likely `rest`/`kong` instability or partial init.

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$APP_PREFIX"
docker logs --tail=120 ${APP_PREFIX}-rest-1
docker logs --tail=120 ${APP_PREFIX}-kong-1
docker logs --tail=120 ${APP_PREFIX}-db-1
docker logs --tail=120 ${APP_PREFIX}-backend-1
```

Then run needed fixes from this file (roles/schema/publication), and restart edge path:

```bash
docker restart ${APP_PREFIX}-rest-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-backend-1 ${APP_PREFIX}-nginx-1
```

---

## Issue: Posting/Profile update 403 with `code 42501` (permission denied table)

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SQL


docker restart ${APP_PREFIX}-rest-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-backend-1
```

---

## Issue: One-off Browser `502` on `/rest/v1/*`

If internal and external retry both return `204/200`, treat as transient upstream blip.

Quick verification:

```bash
# internal

docker exec "$BACKEND" node -e "const k=process.env.SUPABASE_SECRET_KEY;fetch('http://kong:8000/rest/v1/profiles?select=count&limit=1',{headers:{apikey:k,Authorization:'Bearer '+k}}).then(async r=>{console.log(r.status);console.log(await r.text())})"

# external

docker exec "$BACKEND" node -e "const k=process.env.SUPABASE_SECRET_KEY;fetch('https://your-domain.com/rest/v1/profiles?select=count&limit=1',{headers:{apikey:k,Authorization:'Bearer '+k}}).then(async r=>{console.log(r.status);console.log(await r.text())})"
```

If it only happened once and current requests pass, no action required.

---

## Domain Not Reachable

- Verify DNS A record points to VPS.
- Verify Dockploy domain binding.
- Verify TLS status in Dockploy.
- Verify nginx container is up.
