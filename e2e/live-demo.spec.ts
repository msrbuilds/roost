import { test, expect } from '@playwright/test';

// Explicit opt-in: these checks use the public, read-only demo rather than mocked data.
test.describe('public read-only demo', () => {
  test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires an explicitly selected live demo');
  for (const width of [390, 1440]) {
    test(`member tour at ${width}px`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue('demo@roost.example');
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue('ExploreRoost2026!');
      await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
      await expect(page.getByText('Welcome to a community that feels like home', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Write something...', exact: true })).toHaveCount(0);
      const pages = [
        ['/explore', 'Small wins, shared progress'],
        ['/classrooms', 'Design Studio'],
        ['/members', 'Maya Chen'],
        ['/showcase', 'Roost: a place for your people'],
        ['/roadmap', 'A home for every learning journey'],
        ['/leaderboard', 'Maya Chen'],
      ];
      for (const [path, content] of pages) {
        await page.goto(path);
        await expect(page.getByRole('note')).toContainText('Read-only demo');
        await expect(page.getByText(content, { exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} fits at ${width}px`).toBe(true);
      }
      await page.goto('/classrooms/build-with-roost');
      await page.getByRole('button', { name: /^Start here Your first steps/ }).click();
      await page.getByRole('button', { name: /^Welcome to your learning space/ }).filter({ visible: true }).first().click();
      await expect(page.locator('iframe[title="Welcome to your learning space"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Read-only', exact: true })).toBeDisabled();
      await expect(page.getByText(/Lessons, progress, and discussion live together here/)).not.toContainText('<p>');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto('/admin');
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
    });
  }
});
