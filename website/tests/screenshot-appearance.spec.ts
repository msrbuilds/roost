import { test, expect } from './fixtures';

test('member previews switch appearance and preserve it across feature tabs', async ({ page }) => {
  test.setTimeout(90000);
  for (const width of [390, 1440]) for (const path of ['/', '/features/']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    const tour = page.locator('[data-screenshot-tour]');
    const current = tour.locator('.tour-panel:not([hidden])');
    await current.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(current.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(current.locator('img:visible')).toHaveAttribute('alt', /dark mode/);
    await expect(current.getByRole('link', { name: 'Open full-size screenshot', exact: true }).filter({ visible: true })).toHaveAttribute('href', /feed-dark.*\.jpg$/);
    const tabs = tour.getByRole('tablist', { name: 'Product screenshots' });
    const calendar = tabs.getByRole('tab', { name: 'Calendar', exact: true });
    await calendar.click();
    await expect(calendar).toHaveAttribute('aria-selected', 'true');
    await expect(current.locator('img:visible')).toHaveAttribute('alt', /dark mode/);
    // Responsive srcset density can round the browser's intrinsic pixel size.
    await expect.poll(() => current.locator('img:visible').evaluate((img: HTMLImageElement) => img.complete && Math.abs(img.naturalWidth / img.naturalHeight - 1.6) < 0.02)).toBe(true);
    await current.getByRole('button', { name: 'Light', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(current.locator('img:visible')).toHaveAttribute('alt', /light mode/);
    const administration = tabs.getByRole('tab', { name: 'Administration', exact: true });
    await administration.click();
    await expect(administration).toHaveAttribute('aria-selected', 'true');
    await expect(current).toContainText('Local sample installation · admin workspace');
    await expect(current.getByRole('button', { name: 'Dark', exact: true })).toHaveCount(0);
    await expect(current.locator('img:visible')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('an appearance change waits for its image without blanking the current preview', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/\/_astro\/feed-dark\..*\.webp$/, async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/features/');
    const panel = page.locator('#tour-panel-feed');
    await panel.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await expect(panel.locator('img:visible')).toHaveAttribute('alt', /light mode/);
    await expect(panel.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute('aria-pressed', 'true');
    release();
    await expect(panel.locator('img:visible')).toHaveAttribute('alt', /dark mode/);
  } finally { release(); }
});

test('dark documentation screenshots expand without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('/docs/using-roost/');
    const details = page.locator('.screenshot-variant').filter({ has: page.getByText('View dark mode: settings', { exact: true }) });
    await expect(details.locator('img')).not.toBeVisible();
    await details.locator('summary').click();
    await expect(details.locator('img')).toBeVisible();
    await expect(details.locator('img')).toHaveAttribute('alt', /dark mode/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
