import { test, expect } from '@playwright/test';

const liveExpect = expect.configure({ timeout: 15000 });

test.describe('shared demo new-message themes', () => {
  test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires the dedicated live demo');

  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${theme} search and selection at ${width}px`, async ({ page }) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(theme => localStorage.setItem('theme-preference', theme), theme);
        await page.goto('/login');
        await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
        await liveExpect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
        await page.goto('/messages');
        await page.getByRole('button', { name: 'New message', exact: true }).first().click();

        const modal = page.getByRole('dialog', { name: 'New Message', exact: true });
        const input = modal.getByLabel('Search for a user to message');
        await liveExpect(modal).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 23)' : 'rgb(255, 255, 255)');
        await liveExpect(modal.getByRole('heading')).toHaveCSS('color', theme === 'dark' ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)');
        await liveExpect(input).toHaveCSS('background-color', theme === 'dark' ? 'rgb(38, 38, 38)' : 'rgb(250, 250, 250)');

        await input.fill('qzxunmatched937');
        await liveExpect(modal.getByText('No users found')).toBeVisible();
        await modal.getByRole('button', { name: 'Clear user search' }).click();
        await expect(input).toHaveValue('');
        await expect(modal.getByText('No users found')).toHaveCount(0);

        await input.fill('Maya');
        const result = modal.getByRole('button', { name: /Maya Chen @maya/ });
        await liveExpect(result).toBeVisible();
        await expect(result.getByText('Maya Chen', { exact: true })).toHaveCSS('color', theme === 'dark' ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)');
        const bounds = await modal.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        // Selecting a member opens the read-only conversation; no message is sent.
        await result.click();
        await expect(modal).toHaveCount(0);
        await liveExpect(page.getByRole('heading', { name: 'Maya Chen', exact: true, level: 2 })).toBeVisible();
      });
    }
  }
});
