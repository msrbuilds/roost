import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { guides } from '../src/data/site';

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect.soft(results.violations.map(({ id, impact, nodes }) => ({
    id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  }))).toEqual([]);
}

for (const width of [412, 1440]) {
  test(`public pages and all guides have no automated accessibility violations at ${width}px`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/features/', '/docs/', '/compare/', ...guides.map(({ id }) => `/docs/${id}/`)]) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(page.getByRole('button', { name: /^Search documentation/ })).toBeEnabled();
        await audit(page);
      });
    }
  });
}

test('search, mobile navigation, and video controls retain accessible names and states', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Video player</title></head><body><main aria-label="Video player controls"><button style="min-height:44px;padding:12px">Video controls</button></main></body></html>',
  }));
  await page.goto('/');
  await audit(page);
  await page.getByRole('button', { name: 'Watch the Roost intro video', exact: true }).click();
  await audit(page);
  for (const name of ['Calendar', 'Administration']) {
    await page.getByRole('tablist', { name: 'Product screenshots' }).getByRole('tab', { name, exact: true }).click();
    await audit(page);
  }
  await page.getByRole('button', { name: /^Search documentation/ }).click();
  await audit(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await audit(page);
  await page.goto('/docs/supabase-selfhosted/');
  const tables = page.locator('.docs-content table');
  const index = await tables.evaluateAll(elements => elements.findIndex(el => el.scrollWidth > el.clientWidth));
  expect(index).toBeGreaterThanOrEqual(0);
  const table = tables.nth(index);
  await expect(table).toHaveAttribute('tabindex', '0');
  await table.focus();
  await expect(table).toBeFocused();
  await table.press('ArrowRight');
  await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});
