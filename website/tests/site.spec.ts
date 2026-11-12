import { test, expect } from '@playwright/test';
import { join } from 'node:path';

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
