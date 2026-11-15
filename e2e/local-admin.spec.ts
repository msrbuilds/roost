import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const password = process.env.LOCAL_ADMIN_PASSWORD;
const localOrigin = process.env.PLAYWRIGHT_BASE_URL;
const enabled = process.env.ROOST_LOCAL_TESTS === 'true' && password && localOrigin && new URL(localOrigin).hostname === '127.0.0.1';
test.describe('Isolated local administration', () => {
  test.skip(!enabled, 'Explicit local fixture installation required');
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('owner@roost.example');
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });
  test('dashboard shows current-day activity and contributor points without external avatars', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Top Contributors', exact: true })).toBeVisible();
    await expect(page.locator('main')).toContainText('Maya Chen');
    await expect(page.locator('main')).toContainText('20');
    expect(await page.locator('img[src*="ui-avatars.com"]').count()).toBe(0);
    await expect(page.locator('[title$="new members"]').last()).toHaveAttribute('title', /6 new members/);
  });
  test('management routes load and member search filters the actual records', async ({ page }) => {
    for (const [route, heading] of [['users', 'User Management'], ['content', 'Content Moderation'], ['categories', 'Category Management'], ['announcements', 'Announcements'], ['showcases', 'Showcase Moderation'], ['activations', 'Product Activations'], ['live-room', 'Live Room'], ['backups', 'Database Backups'], ['site-settings', 'Site Settings']]) {
      await page.goto(`/admin/${route}`);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText('Error loading', { exact: false })).toHaveCount(0);
    }
    await page.goto('/admin/users');
    await page.getByPlaceholder('Search users...').fill('Maya');
    await expect(page.getByRole('cell', { name: 'Maya Chen @maya', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Jordan Lee @jordan', exact: true })).toHaveCount(0);
  });
  test('owner settings persist and a real database backup can be created and downloaded', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/admin/site-settings');
    await expect(page.getByPlaceholder('My Community')).toHaveValue('Roost');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.reload();
    await expect(page.getByPlaceholder('My Community')).toHaveValue('Roost');
    await page.goto('/admin/backups');
    await page.getByRole('button', { name: 'Create Backup Now', exact: true }).click();
    await expect(page.getByText(/Backup completed successfully/)).toBeVisible({ timeout: 30000 });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).first().click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^backup-.*\.sql\.gz$/);
    expect(gunzipSync(await readFile((await file.path())!)).toString('utf8')).toContain('CREATE TABLE');
  });
});
