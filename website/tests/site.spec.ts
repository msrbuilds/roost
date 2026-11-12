import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

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
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/features/', '/docs/', '/docs/backups/']) {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
    }
  }
  if (process.env.ROOST_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-mobile.png'), fullPage: true });
  }
});

test('documentation search finds and opens the recovery guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search documentation', exact: true }).click();
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
  const search = page.getByRole('button', { name: 'Search documentation', exact: true });
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
  const copy = page.getByRole('button', { name: 'Copy code to clipboard', exact: true }).first();
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
        return pre.scrollWidth <= pre.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1
          && code.getBoundingClientRect().right <= pre.getBoundingClientRect().right + 1
          && button.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top + 1;
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
