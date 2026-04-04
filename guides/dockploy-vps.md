# Dockploy (VPS) Deployment Guide

Dockploy deployment guide for Roost using `docker-compose.dokploy.yml`.

This assumes Dockploy is already installed and running on your VPS.

---

## Required Env Vars (Add First)

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

## Generate Secrets and Keys

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

### Domain not reachable

- Verify DNS A record.
- Verify Dockploy domain binding and TLS state.
