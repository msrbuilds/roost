# Contributing

This page is how to run Roost locally, run the checks that exist in this repository, and open an issue or pull request.

Setup and operations docs are at <https://roost.msrbuilds.com/docs/>. The guides in this repository are the source for that site. The shared demo is at <https://roost-demo.msrbuilds.com/>. It is read-only: account changes, content writes, uploads, and paid memberships are disabled. For a writable local installation, use the sample community below.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Run the app locally

The app requires Node.js 22 or newer (`package.json` sets `>=22.0.0`) and npm. You also need a configured Supabase project, S3-compatible file storage, and account email. See [setup prerequisites](guides/self-hosted-setup.md#prerequisites).

```bash
git clone https://github.com/msrbuilds/roost.git
cd roost
npm ci
npm ci --prefix server

cp .env.example .env.local
cp server/.env.example server/.env
```

Edit both environment files. For a new database, run `schema.sql` once. It is a fresh-install schema, not an upgrade. Do not rerun it over an existing database; that needs a reviewed migration. Apply it from the Supabase SQL editor, or with the `psql` command in [guides/supabase-selfhosted.md](guides/supabase-selfhosted.md#step-3-install-the-database-schema). Then follow [Create First Admin User](guides/self-hosted-setup.md#3-create-first-admin-user).

```bash
npm run dev:all
```

The frontend runs at `http://localhost:5000` and the API at `http://localhost:3000`. Start them separately with `npm run dev` and `npm run dev:server`.

`bash install.sh` asks for community, database, and deployment choices and writes the environment files. If you accept its dependency prompt, it runs `npm install` and `cd server && npm install`. For the local development target it tells you to run `npm run dev` and `cd server && npm run dev`.

Do not commit `.env`, `.env.local`, `server/.env`, or other local environment files.

### Writable sample community

This loopback-only installation is separate from the public demo. It needs Docker with Linux containers and Docker Compose v2. The settings are for local development, not a public deployment.

```bash
node scripts/create-screenshot-env.cjs

docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml up -d --build

docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml exec -T -e ROOST_SCREENSHOT_SEED=true backend node scripts/seed-screenshots.cjs
```

- App: `http://127.0.0.1:15489`
- Private email inbox: `http://127.0.0.1:15490`

Stop it and keep its data:

```bash
docker compose --env-file .env.screenshots.local -p roost-screenshots -f docker-compose.dokploy.yml -f docker-compose.local.yml stop
```

The sample member and owner accounts are listed in the README under [Local sample community](README.md#local-sample-community). The owner password is the generated `LOCAL_ADMIN_PASSWORD` in `.env.screenshots.local`.

## Checks

Run these from the repository root.

| Command | What it runs |
| --- | --- |
| `npm run check` | `npm run typecheck`, `npm run lint`, and `npm run test:run` |
| `npm run typecheck` | `tsc --noEmit` for the React app in `src/` |
| `npm run lint` | ESLint on `src`, `server/src`, `e2e`, and root `*.ts` / `*.js` files |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (`src/**/*.{test,spec}.{ts,tsx}`) |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:ui` | Vitest UI |
| `npm run build` | `npm run check`, then the production frontend build |
| `npm run build:server` | TypeScript compile of `server/` (`cd server && npm run build`) |
| `npm run build:all` | `npm run build` and `npm run build:server` |

`npm run check` does not compile the server. If you change `server/src`, also run `npm run build:server`. The server package has `npm run dev`, `npm run build`, `npm run start`, and `npm run lint`. It has no test script.

### Browser tests

The [website workflow](.github/workflows/website.yml) installs Chromium before its browser tests:

```bash
npx playwright install --with-deps chromium
```

`npm run test:e2e` runs Playwright in `e2e/`. When `PLAYWRIGHT_BASE_URL` is unset, Playwright runs `npm run build:e2e` and serves that build with `npm run preview` at `http://localhost:5000`. `build:e2e` sets `VITE_SUPABASE_URL` to `http://127.0.0.1:54321` and `VITE_API_URL` to `http://127.0.0.1:3001`. It does not start Supabase or the API.

What actually runs depends on the environment:

- `e2e/auth.spec.ts` checks the login and signup pages in that preview.
- `e2e/posts.spec.ts` is skipped unless `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set. [guides/staging-tests.md](guides/staging-tests.md) describes those variables against a disposable installation, together with `PLAYWRIGHT_BASE_URL`.
- `e2e/live-demo.spec.ts`, `e2e/live-demo-details.spec.ts`, and `e2e/live-demo-stability.spec.ts` are skipped unless `ROOST_DEMO_BROWSER_TESTS=true`. The demo command is in [guides/live-demo.md](guides/live-demo.md).
- `e2e/local-admin.spec.ts` is skipped unless `ROOST_LOCAL_TESTS=true`, `LOCAL_ADMIN_PASSWORD` is set, and `PLAYWRIGHT_BASE_URL` uses the host `127.0.0.1`.

`npm run test:e2e:ui` and `npm run test:e2e:headed` run the same suite in Playwright's UI and in a visible browser.

### Product website and docs

The site in `website/` is the published docs. It does not need a database, application credentials, or a running Roost server. It requires Node.js 22.23.4 or newer (`website/package.json`). The pinned version in `website/.node-version` is 22.23.5.

```bash
cd website
npm ci
npm run dev
```

The dev server is `http://127.0.0.1:4321`.

```bash
npm run check
npm run build
npm run preview
```

`npm run build` checks Astro and TypeScript, builds the static site, generates the Pagefind index, and checks links. Edit installation and operations docs in `guides/`. The site reads those files directly. Do not copy them into `website/`.

From the repository root, after root `npm ci`, the Chromium install above, and `npm run build` inside `website/`:

```bash
npm run test:website
```

Set `WEBSITE_BASE_URL` to test a deployed site instead of the local preview. See [website/README.md](website/README.md).

## Database changes

Update `schema.sql` for clean installs, and update `src/types/database.ts` in the same change when the public schema changes. Existing installations need a separate, reviewed migration.

## Reporting bugs

Use the [bug report form](https://github.com/msrbuilds/roost/issues/new?template=bug_report.yml). Include what you did, what you expected, what happened, and whether this was local development, Docker, the self-hosted stack, or the public demo. Add the app version, browser, and relevant logs with secrets removed.

Do not include passwords, service keys, tokens, or member data.

## Proposing a change

Use the [feature request form](https://github.com/msrbuilds/roost/issues/new?template=feature_request.yml). Describe the problem and the behavior you want. A small pull request is also fine when the change is already clear.

Blank issues are allowed. Questions about installing or operating a community are often answered in the [docs](https://roost.msrbuilds.com/docs/).

## Pull requests

Open pull requests against `main`.

- Keep the change focused on one problem.
- Describe what changed and how you checked it.
- For application changes, run `npm run check`. If you change `server/`, also run `npm run build:server`.
- For `guides/` or `website/` changes, run `npm run check` and `npm run build` in `website/`.
- Leave out `dist/` output, local environment files, and secrets.

The pull request template is a short checklist of those expectations.
