# Roost product website

Static Astro product information and documentation for `https://roost.msrbuilds.com`.
The community application remains in the repository root. The website needs no
database, application credentials, or running Roost server.

## Local development

Use Node.js 22.23.4 or newer (the pinned build version is in `.node-version`).

```bash
cd website
npm ci
npm run dev
```

The local development address is `http://127.0.0.1:4321`.

## Production validation

```bash
npm run build
npm run preview
```

The build checks Astro/TypeScript, renders the static site, generates Pagefind's
documentation index, and verifies internal links, assets, titles, descriptions,
and canonical URLs. Search is available in the production preview after building.

## Content and graphics

Browser regressions are maintained in `tests/`. After installing the repository
root dependencies, run `npm run test:website` from the repository root against
the built preview. Set `WEBSITE_BASE_URL` to test a deployed site instead.

- Product configuration and documentation navigation: `src/data/site.ts`.
- Installation and operations documentation: the repository's `guides/` directory.
  The Astro content collection reads these files directly; do not duplicate them.
- Marketing pages and layouts: `src/pages/` and `src/layouts/`.
- Selected supplied screenshots: `src/assets/`. Astro generates responsive WebP
  output. Do not add PSDs or the entire graphics source folder to the build.
- Public brand assets, robots.txt, and Cloudflare security headers: `public/`.

## Cloudflare deployment

Deploy the contents of `dist/` as a static Cloudflare Pages site. For a Git-based
build of this monorepo, build from the repository root using:

```bash
npm --prefix website ci && npm --prefix website run build
```

Set the output directory to `website/dist` and the Node version to `22.23.5`.
Building from the repository root keeps the shared `guides/` directory available.
No server adapter or runtime environment secrets are required.

The canonical domain is configured in `astro.config.mjs` and `public/robots.txt`.
Keep both synchronized if the domain changes. Preserve existing DNS records for
other services when adding the `roost` subdomain.

## Launch sequence

1. Validate the app and website and publish the corrected source to the public repository.
2. Deploy the built static website and verify the preview deployment.
3. Connect `roost.msrbuilds.com` and verify DNS, HTTPS, documentation search,
   code copying, navigation, responsive layout, and security headers.
4. Publish the release information with links to installation instructions.

This launch is the free self-hosted product. It does not provision a hosted
community, enable paid memberships, or restore the removed staging infrastructure.
