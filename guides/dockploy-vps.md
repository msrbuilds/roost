# Dockploy (VPS) Deployment Guide

Dockploy deployment guide for Roost using `docker-compose.dokploy.yml`.

This assumes Dockploy is already installed and running on your VPS.

---

## Recommended: Auto-generate Env (Installer)

Run installer and choose:

1. `Supabase Self-hosted`
2. `Auto-generate JWT/anon/service keys`
3. `Dockploy (Self-hosted VPS)`

```bash
bash install.sh
```

Installer generates `.env.dokploy` with all required Supabase secrets and keys.
In Dockploy, paste values from `.env.dokploy` into app environment settings.
This keeps user input focused on domain/community/options while cryptographic keys are generated safely.

---

## Manual Required Env Vars (If Not Using Installer)

Add these in Dockploy app environment settings before first deploy:

```env
ROOST_DOMAIN=community.example.com
POSTGRES_PASSWORD=change-me-strong-db-password
JWT_SECRET=change-me-very-long-random-secret
ANON_KEY=change-me-jwt-anon-key
SERVICE_ROLE_KEY=change-me-jwt-service-role-key
SECRET_KEY_BASE=change-me-very-long-random-secret
```

Important:

- Deploy will fail fast if any required key is missing.
- `ANON_KEY` and `SERVICE_ROLE_KEY` must be generated from the same `JWT_SECRET`.

---

## Manual Secret Generation (If Not Using Installer)

Run this on any machine with `openssl` + `node`:

```bash
JWT_SECRET="$(openssl rand -hex 32)"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
SECRET_KEY_BASE="$(openssl rand -hex 32)"

echo "JWT_SECRET=$JWT_SECRET"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "SECRET_KEY_BASE=$SECRET_KEY_BASE"

JWT_SECRET="$JWT_SECRET" node -e '
const crypto = require("crypto");
const secret = process.env.JWT_SECRET;
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 365 * 10; // 10 years
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, iss: "supabase", iat: now, exp });
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
console.log("ANON_KEY=" + sign("anon"));
console.log("SERVICE_ROLE_KEY=" + sign("service_role"));
'
```

Windows PowerShell (`pwsh`) variant:

```powershell
$jwtSecret = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
$postgresPassword = node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))"
$secretKeyBase = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"

Write-Output "JWT_SECRET=$jwtSecret"
Write-Output "POSTGRES_PASSWORD=$postgresPassword"
Write-Output "SECRET_KEY_BASE=$secretKeyBase"

$env:JWT_SECRET = $jwtSecret
node -e @'
const crypto = require("crypto");
const secret = process.env.JWT_SECRET;
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 365 * 10; // 10 years
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, iss: "supabase", iat: now, exp });
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
console.log("ANON_KEY=" + sign("anon"));
console.log("SERVICE_ROLE_KEY=" + sign("service_role"));
'@
```

Paste the printed values into Dockploy env settings.

---

## Optional Env Vars

```env
APP_NAME=Roost
GOTRUE_AUTOCONFIRM=false

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@example.com

STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

AWS_REGION=us-east-1
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## Deploy In Dockploy

1. Open Dockploy dashboard.
2. Create or open your Roost app.
3. Choose **Docker Compose**.
4. Set compose path to `docker-compose.dokploy.yml`.
5. Add the required env vars above.
6. Add optional vars as needed.
7. Deploy.

---

## Domain and SSL

1. Bind `ROOST_DOMAIN` to your Dockploy app.
2. Point DNS A record to your VPS IP.
3. Let Dockploy issue TLS certificate.

---

## Verify

After deployment:

```bash
curl https://your-domain.com/api/health
```

---

## Troubleshooting

### `db` unhealthy / `dependency failed to start`

Usually missing required env vars. Re-check:

- `ROOST_DOMAIN`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `SECRET_KEY_BASE`

If your first deploy was attempted without required env vars, the DB volume may be partially initialized.
In that case:

1. Stop/remove the Dockploy app stack.
2. Delete the app's `db-data` volume from Dockploy.
3. Redeploy with all required env vars set.

### Auth/API failures

- Ensure `ANON_KEY`, `SERVICE_ROLE_KEY`, and `JWT_SECRET` are aligned.

### `password authentication failed for user "supabase_auth_admin"` (or `authenticator` / `supabase_storage_admin`)

This means your DB volume was initialized with a different `POSTGRES_PASSWORD` than the current one in Dockploy env.

Fastest fix for fresh installs:

1. Keep your current Dockploy env values.
2. Stop the app stack.
3. Delete the app `db-data` volume.
4. Redeploy (roles are recreated with current password).

If you must keep existing DB data, repair Supabase role passwords + grants + search paths inside Postgres.

SQL:

```sql
ALTER ROLE supabase_auth_admin WITH PASSWORD '<POSTGRES_PASSWORD>';
ALTER ROLE authenticator WITH PASSWORD '<POSTGRES_PASSWORD>';
ALTER ROLE supabase_storage_admin WITH PASSWORD '<POSTGRES_PASSWORD>';
ALTER ROLE supabase_admin WITH PASSWORD '<POSTGRES_PASSWORD>';

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
```

If roles do not exist at all (`role "supabase_auth_admin" does not exist`), run bootstrap SQL once inside DB container:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
DB_CTR="${APP_PREFIX}-db-1"

docker exec -u postgres "$DB_CTR" psql -d postgres -f /docker-entrypoint-initdb.d/00-supabase-roles.sql \
  || docker exec -u postgres "$DB_CTR" psql -d postgres -f /docker-entrypoint-initdb.d/migrations/00-supabase-roles.sql

docker exec -u postgres "$DB_CTR" psql -d postgres -f /docker-entrypoint-initdb.d/99-roost-schema.sql \
  || docker exec -u postgres "$DB_CTR" psql -d postgres -f /docker-entrypoint-initdb.d/migrations/99-roost-schema.sql
```

Container command example (Linux/macOS shell):

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
DB_CTR="${APP_PREFIX}-db-1"
PASS="$(docker inspect "$DB_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"

docker exec -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -v pass="$PASS" <<'SQL'
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

PowerShell (`pwsh`) variant:

```powershell
$appPrefix = "your-app-prefix" # example: roost-roost-hbo1wt
$dbCtr = "$appPrefix-db-1"
$pass = docker inspect $dbCtr --format '{{range .Config.Env}}{{println .}}{{end}}' |
  Select-String '^POSTGRES_PASSWORD=' |
  ForEach-Object { $_.ToString().Split('=')[1] }

$sql = @"
ALTER ROLE supabase_auth_admin WITH PASSWORD '$pass';
ALTER ROLE authenticator WITH PASSWORD '$pass';
ALTER ROLE supabase_storage_admin WITH PASSWORD '$pass';
ALTER ROLE supabase_admin WITH PASSWORD '$pass';
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
"@

$sql | docker exec -i -e PGPASSWORD=$pass $dbCtr psql -U postgres -d postgres
```

### `permission denied for schema public`, `permission denied for database postgres`, or Realtime `no schema has been selected to create in`

These are the same root cause: service roles exist but are missing grants/search-path defaults.  
Run the repair block above, then restart affected services.

### Backend `/api/health` = 503 and Kong `/rest/v1/...` = 403

If backend health is 503 and direct request through Kong returns 403, either:

1. Kong key mapping is wrong, or
2. `service_role` exists but lacks permissions in Postgres.

Quick checks:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
BACKEND="${APP_PREFIX}-backend-1"
KONG="${APP_PREFIX}-kong-1"

# Ensure Kong template placeholders were replaced
docker exec "$KONG" sh -lc "grep -n '__SUPABASE_.*__' /home/kong/kong.yml || true"

# Compare backend key vs key loaded in kong.yml (hash only)
BKEY="$(docker inspect "$BACKEND" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^SUPABASE_SECRET_KEY=//p')"
KONG_FILE_KEY="$(docker exec "$KONG" sh -lc "cat /home/kong/kong.yml" \
  | awk '/username: service_role/{f=1} f&&/key:/{sub(/^ +key: /,""); print; exit}' \
  | tr -d '\r\n')"
printf '%s' "$BKEY" | tr -d '\r\n' | sha256sum
printf '%s' "$KONG_FILE_KEY" | sha256sum
```

If hashes differ, redeploy so Kong picks the current env values.

If hashes match but 403 persists, fix `service_role` grants:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
DB_CTR="${APP_PREFIX}-db-1"
PASS="$(docker inspect "$DB_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"

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

### Frontend shows `503` and console says `name resolution failed`

Typical symptoms:

- Browser console: `Failed to load resource ... 503`
- Supabase query errors with message like `name resolution failed`
- Requests to `/rest/v1/...` fail from frontend

Run this triage block:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt

docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$APP_PREFIX"
docker logs --tail=120 ${APP_PREFIX}-rest-1
docker logs --tail=120 ${APP_PREFIX}-kong-1
docker logs --tail=120 ${APP_PREFIX}-db-1
docker logs --tail=120 ${APP_PREFIX}-backend-1
```

Most common causes:

1. `rest` is unhealthy/restarting because DB roles/schema were not initialized fully.
   - Apply the DB repair steps in this guide (`password auth failed`, `factor_type missing`, `profiles missing`).
2. Kong key mapping mismatch (`/rest/v1` returns 403).
   - Apply the Kong/service-role fixes in this guide.
3. Frontend built with stale env/domain.
   - Rebuild/redeploy frontend after confirming `ROOST_DOMAIN` and Supabase keys are correct.

Quick verify after fixes:

```bash
docker exec ${APP_PREFIX}-backend-1 sh -lc 'wget -S -qO- \
  --header="apikey: $SUPABASE_SECRET_KEY" \
  --header="Authorization: Bearer $SUPABASE_SECRET_KEY" \
  "http://kong:8000/rest/v1/profiles?select=count&limit=1"; echo'

curl -i https://your-domain.com/api/health
```

### `ERROR: type "auth.factor_type" does not exist` (GoTrue/Auth restart loop)

This happens when GoTrue MFA migrations were partially applied in an earlier failed boot.

Run this once against the DB container:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
DB_CTR="${APP_PREFIX}-db-1"
PASS="$(docker inspect "$DB_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"

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
```

Then restart Auth and API services:

```bash
docker restart ${APP_PREFIX}-auth-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-backend-1
```

### `Supabase error: relation "public.profiles" does not exist` on `/api/health`

This means Roost app schema (`schema.sql`) was not applied to the current DB volume
(common after partial first boots or volume reuse).

Apply schema manually:

```bash
APP_PREFIX="your-app-prefix" # example: roost-roost-hbo1wt
DB_CTR="${APP_PREFIX}-db-1"
PASS="$(docker inspect "$DB_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"

# Prefer mounted init path; fallback to compose bind path if needed.
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/99-roost-schema.sql \
  || docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/migrations/99-roost-schema.sql

docker restart ${APP_PREFIX}-backend-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-nginx-1
```

Verify:

```bash
docker exec -i -e PGPASSWORD="$PASS" "$DB_CTR" psql -U postgres -d postgres -c "select to_regclass('public.profiles');"
curl -sS https://your-domain.com/api/health
```

If manual schema apply prints many `already exists` errors, that is usually expected on re-apply.
What matters is core objects exist and backend can answer health.

If schema apply reports `publication "supabase_realtime" does not exist`, run:

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

Then restart app edge services and verify backend from inside nginx:

```bash
docker restart ${APP_PREFIX}-backend-1 ${APP_PREFIX}-kong-1 ${APP_PREFIX}-nginx-1
docker exec ${APP_PREFIX}-nginx-1 wget -S -O- http://backend:3001/api/health
curl -i https://your-domain.com/api/health
```

### Domain not reachable

- Verify DNS A record.
- Verify Dockploy domain binding and TLS state.
