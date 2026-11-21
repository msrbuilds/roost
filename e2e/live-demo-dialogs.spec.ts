import { test, expect } from '@playwright/test';

const liveExpect = expect.configure({ timeout: 15000 });
test.describe('shared demo dialogs and global search', () => {
    test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires the dedicated live demo');
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
        test(`${theme} controls at ${width}px`, async ({ page }) => {
            test.setTimeout(120000);
            await page.setViewportSize({ width, height: 800 });
            await page.addInitScript(theme => localStorage.setItem('theme-preference', theme), theme);
            await page.goto('/login');
            await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
            await liveExpect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();

            if (width < 768) await page.getByRole('button', { name: 'Open search', exact: true }).click();
            const search = page.getByPlaceholder('Search members, posts, classrooms...').filter({ visible: true });
            await search.fill('Maya');
            const clear = page.getByRole('button', { name: 'Clear search', exact: true }).filter({ visible: true });
            await clear.click();
            await expect(search).toHaveValue('');
            await search.fill('qzxunmatched937');
            const empty = page.getByText('No results found for "qzxunmatched937"');
            await liveExpect(empty).toBeVisible();
            await expect(empty).toHaveCSS('color', theme === 'dark' ? 'rgb(163, 163, 163)' : 'rgb(115, 115, 115)');
            await search.press('Escape');
            await expect(empty).toHaveCount(0);
            if (width < 768) await page.getByRole('button', { name: 'Open search', exact: true }).click();
            await search.fill('Maya');
            await liveExpect(page.getByRole('button', { name: 'Maya Chen @maya', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Maya Chen @maya', exact: true }).click();
            await liveExpect(page.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();

            await page.setViewportSize({ width, height: 500 });
            await page.getByRole('button', { name: 'Notifications', exact: true }).click();
            const notifications = page.getByRole('dialog', { name: 'Notifications', exact: true });
            await liveExpect(notifications).toBeVisible();
            const bounds = await notifications.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.y).toBeGreaterThanOrEqual(0);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
            await notifications.getByRole('button', { name: 'Close notifications', exact: true }).click();
            await expect(notifications).toHaveCount(0);

            await page.setViewportSize({ width, height: 800 });
            // The shared demo's example event is seeded on November 18.
            await page.clock.setFixedTime(new Date('2026-11-18T12:00:00Z'));
            await page.goto('/calendar');
            await page.getByRole('button', { name: 'Agenda', exact: true }).click();
            await liveExpect(page.getByRole('button', { name: 'Community co-working · example event', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Community co-working · example event', exact: true }).click();
            const event = page.getByRole('dialog', { name: 'Community co-working · example event' });
            await liveExpect(event).toBeVisible();
            await event.getByRole('button', { name: 'Close event details', exact: true }).click();
            await expect(event).toHaveCount(0);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        });
    }
});
