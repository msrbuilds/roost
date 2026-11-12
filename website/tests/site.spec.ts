import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { guides } from '../src/data/site';

// Exercise the real production policy locally, where astro preview does not
// apply Cloudflare's _headers file. Deployed-site runs use actual HTTP headers.
const csp = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  .split('\n').find((line) => line.trim().startsWith('Content-Security-Policy:'))!
  .trim().slice('Content-Security-Policy:'.length).trim();
test.beforeEach(async ({ page, baseURL }) => {
  if (baseURL?.startsWith('http://127.0.0.1:')) {
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
  }
});

test('product, features, and docs fit desktop and mobile widths', async ({ page }) => {
  test.setTimeout(90000);
  const routes = ['/', '/features/', '/docs/', '/privacy/', '/this-page-does-not-exist/', ...guides.map(({ id }) => `/docs/${id}/`)];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(route === '/this-page-does-not-exist/' ? 404 : 200);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  if (process.env.ROOST_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-mobile.png'), fullPage: true });
  }
});

test('navigation closes with Escape and resets when switching to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.menu-trigger');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
  await toggle.click();
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).toBeHidden();
  await page.goto('/docs/self-hosted-setup/');
  const docsToggle = page.getByRole('button', { name: 'Browse documentation' });
  await docsToggle.click();
  await expect(page.locator('#docs-sidebar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#docs-sidebar')).toBeHidden();
  await expect(docsToggle).toBeFocused();
});

test('keyboard search handles no results and restores focus', async ({ page }) => {
  await page.goto('/features/');
  const trigger = page.getByRole('button', { name: /^Search documentation/ });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('searchbox', { name: 'Search documentation', exact: true });
  await expect(input).toBeFocused();
  await input.fill('qzxwvplm937248');
  await expect(page.locator('#search-status')).toContainText('No results.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('copying remains possible when clipboard permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('/docs/backups/');
  const box = page.locator('.code-block').first();
  const code = await box.locator('code').textContent();
  await box.getByRole('button', { name: 'Copy code to clipboard', exact: true }).click();
  await expect(box.locator('button')).toHaveText('Code selected');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(code);
});

test('product screenshots load and missing pages offer recovery links', async ({ page }) => {
  for (const route of ['/', '/features/']) {
    await page.goto(route);
    for (const image of await page.locator('main img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
  }
  const response = await page.goto('/this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('This perch is');
  await page.getByRole('link', { name: 'Browse the docs →', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/$/);
});

test('documentation search finds and opens the recovery guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Search documentation/ }).click();
  await page.getByRole('searchbox', { name: 'Search documentation', exact: true }).fill('backups');
  const result = page.getByRole('dialog').locator('a[href="/docs/backups/"]');
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/docs\/backups\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Backups & recovery', exact: true })).toBeVisible();
});

test('controls wait for their handlers when the site script is delayed', async ({ page }) => {
  let releaseScript!: () => void;
  const scriptReady = new Promise<void>((resolve) => { releaseScript = resolve; });
  await page.route('**/_astro/*.js', async (route) => { await scriptReady; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  const search = page.getByRole('button', { name: /^Search documentation/ });
  await expect(search).toBeDisabled();
  releaseScript();
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByRole('searchbox', { name: 'Search documentation', exact: true })).toBeVisible();
});

test('mobile menus and code copying work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Documentation', exact: true }).click();
  await page.locator('main').getByRole('link', { name: 'Getting started', exact: true }).click();
  await page.getByRole('button', { name: 'Browse documentation' }).click();
  await page.getByRole('complementary', { name: 'Documentation navigation' }).getByRole('link', { name: 'Backups & recovery', exact: true }).click();
  const copy = page.locator('.copy-code').first();
  await copy.click();
  await expect(copy).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('AWS_BACKUP_BUCKET=your-private-backup-bucket');
});

test('code boxes wrap without internal scrolling and preserve copied commands', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/docs/', '/docs/self-hosted-setup/', '/docs/backups/', '/docs/dockploy-vps/']) {
      await page.goto(route);
      const boxes = page.locator('.code-block');
      await expect(boxes.first()).toBeVisible();
      expect(await boxes.evaluateAll((elements) => elements.every((box) => {
        const pre = box.querySelector('pre')!;
        const code = pre.querySelector('code')!;
        const button = box.querySelector('button')!;
        const inline = box.classList.contains('code-block-inline');
        return pre.scrollWidth <= pre.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1
          && code.getBoundingClientRect().right <= pre.getBoundingClientRect().right + 1
          && (inline
            ? button.getBoundingClientRect().left >= pre.getBoundingClientRect().right
            : button.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top + 1);
      })), `${route} code boxes at ${width}px`).toBe(true);
      const original = await boxes.first().locator('code').textContent();
      await boxes.first().getByRole('button', { name: 'Copy code to clipboard', exact: true }).click();
      await expect(boxes.first().getByRole('button')).toHaveText('Copied');
      // Windows' clipboard normalizes line endings to CRLF.
      expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(original?.replace(/\r\n/g, '\n'));
      if (route === '/docs/') expect(original).toBe('git clone https://github.com/msrbuilds/roost.git\ncd roost\nbash install.sh');
    }
  }
});

test('the homepage install command stays compact with Copy beside it', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const box = page.locator('.install-strip .code-block-inline');
    await expect(box).toBeVisible();
    const bounds = await box.boundingBox();
    expect(bounds!.height).toBeLessThan(width >= 800 ? 70 : 150);
    await expect(box.locator('.code-toolbar')).toHaveCount(0);
    const pre = await box.locator('pre').boundingBox();
    const button = await box.getByRole('button', { name: 'Copy code to clipboard', exact: true }).boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(pre!.x + pre!.width);
  }
});

test('single-line docs commands stay compact and copy their complete contents', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const examples = [
    ['self-hosted-setup', "SELECT setup_first_admin('your-email@example.com');"],
    ['docker-vps', 'docker compose up -d --build'],
    ['dockploy-vps-troubleshooting', 'docker exec "$KONG" sh -lc "grep -n'],
    ['dockploy-vps-troubleshooting', 'docker restart ${APP_PREFIX}-rest-1'],
    ['dockploy-vps', 'psql -U postgres -d postgres -c'],
    ['install-script', 'bash install.sh'],
    ['netlify', 'netlify plugins:install netlify-plugin-lighthouse'],
    ['supabase-selfhosted', 'docker compose up -d'],
    ['supabase-selfhosted', 'docker compose restart'],
  ];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [guide, command] of examples) {
      await page.goto(`/docs/${guide}/`);
      const box = page.locator('.docs-content .code-block-inline').filter({ hasText: command }).first();
      await expect(box).toBeVisible();
      await expect(box.locator('.code-toolbar')).toHaveCount(0);
      const code = await box.locator('code').textContent();
      expect(code?.trimEnd()).not.toMatch(/[\r\n]/);
      expect(await box.evaluate((element) => {
        const pre = element.querySelector('pre')!;
        const button = element.querySelector('button')!;
        return pre.scrollWidth <= pre.clientWidth + 1
          && pre.scrollHeight <= pre.clientHeight + 1
          && button.getBoundingClientRect().left >= pre.getBoundingClientRect().right
          && element.getBoundingClientRect().right <= document.documentElement.clientWidth + 1;
      }), `${guide} at ${width}px`).toBe(true);
      await box.locator('button').click();
      await expect(box.locator('button')).toHaveText('Copied');
      expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code?.replace(/\r\n/g, '\n'));
    }
    // The installer example has three actual commands and keeps its toolbar.
    await page.goto('/docs/self-hosted-setup/');
    const multiline = page.locator('.docs-content .code-block').filter({ hasText: 'git clone https://github.com/msrbuilds/roost.git' }).first();
    await expect(multiline).not.toHaveClass(/code-block-inline/);
    await expect(multiline.locator('.code-toolbar')).toBeVisible();
  }
});
