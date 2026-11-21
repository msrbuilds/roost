import { test, expect } from '@playwright/test';

const liveExpect = expect.configure({ timeout: 15000 });
test.describe('final demo appearance and classroom navigation', () => {
    test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires the dedicated live demo');
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
        test(`${theme} at ${width}px`, async ({ page }) => {
            test.setTimeout(90000);
            await page.setViewportSize({ width, height: 900 });
            await page.addInitScript(value => localStorage.setItem('theme-preference', value), theme);
            await page.goto('/login');
            await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
            await liveExpect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();

            await page.goto('/settings');
            if (theme === 'dark') {
                await liveExpect(page.getByRole('button', { name: 'Profile', exact: true })).toHaveCSS('background-color', /^rgba\(.+, 0\.3\)$/);
            }
            await page.goto('/roadmap');
            await liveExpect(page.getByRole('button', { name: width < 640 ? 'Submit' : 'Submit Request', exact: true })).toBeDisabled();

            const failedReads: string[] = [];
            page.on('response', response => {
                if (response.status() >= 400 && /\/(rest\/v1|api)\//.test(new URL(response.url()).pathname)) failedReads.push(response.url());
            });
            await page.goto('/classrooms/build-with-roost/leaderboard');
            const back = page.getByRole('link', { name: 'Back to Classroom', exact: true });
            await liveExpect(back).toHaveAttribute('href', '/classrooms/build-with-roost');
            await liveExpect(page.locator('main .animate-spin')).toHaveCount(0);
            expect(failedReads).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await back.click();
            await liveExpect(page).toHaveURL(/\/classrooms\/build-with-roost$/);
        });
    }
});
