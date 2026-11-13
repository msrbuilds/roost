# Read-only live demo

The public demo is a separate Dokploy Compose deployment at
`https://roost-demo.msrbuilds.com`. It contains fictional community data and a
shared member account, not an administrator account. Paid memberships, signup,
uploads, email sending, and public writes are disabled.

Use `docker-compose.dokploy.yml` with fresh installation secrets and these settings:

```dotenv
ROOST_DOMAIN=roost-demo.msrbuilds.com
APP_NAME=Roost Demo
VITE_DEMO_MODE=true
VITE_ENABLE_SIGNUP=false
GOTRUE_DISABLE_SIGNUP=true
STRIPE_ENABLED=false
ROOST_PROXY_CONFIG=./dokploy-template/nginx-demo.conf
```

The frontend flag displays the shared login and a demo notice. The selected nginx
configuration enforces read-only access, including direct REST, Auth, Storage,
and backend API requests. It allows password login, session refresh, logout,
reads, and explicitly listed read-only RPCs. Never bind a public domain directly
to the frontend, Kong, database, or backend: bind only `nginx:80`. Keep every
service on a private Compose network; only nginx also needs `dokploy-network`.
Never use the shared account or these demo settings on a real community database.

After the isolated stack is healthy, run in the **backend** container terminal:

```sh
ROOST_DEMO_SEED=true node scripts/seed-demo.cjs
```

The idempotent seed refuses databases with non-demo accounts and creates no
platform administrators. It includes fictional profiles, classrooms, lessons,
posts, an example event, a showcase, and a roadmap item. The example lesson
embeds [Traversy Media's public HTML crash course](https://www.youtube.com/watch?v=UB1O30fR-EE).
Do not upload private or real member data to this instance. Container volumes
persist between deployments; recreating them discards the sample community.

Run the public integration checks from the repository using Node 22 or later:

```sh
DEMO_URL=https://roost-demo.msrbuilds.com DEMO_ANON_KEY=your-public-anon-jwt node scripts/demo-smoke.cjs
```

These tests verify real login, refresh, reads, and rejection of password changes,
signup, MFA enrollment, content changes, privileged RPCs, uploads, checkout,
backup creation, and admin APIs. Run them after every demo deployment. A new
read-only RPC must be reviewed before adding it to the proxy allowlist.

The deliberately public member credentials are `demo@roost.example` /
`ExploreRoost2026!`. Both the login screen and seeder use the same values.
