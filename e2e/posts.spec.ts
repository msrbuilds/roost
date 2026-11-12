import { test, expect } from '@playwright/test';

const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;

test.describe('Authenticated community', () => {
  test.skip(!email || !password, 'A staging test account is required');
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(email!);
    await page.getByLabel(/^password$/i).fill(password!);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
  });
  test('loads the authenticated feed on desktop and mobile', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Write something...', exact: true })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Write something...', exact: true })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('persists a post, reaction and comment through reload', async ({ page }) => {
    const title = `Browser regression ${Date.now()}`;
    const comment = `Persisted browser comment ${Date.now()}`;
    await page.getByRole('button', { name: 'Write something...', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create Post', exact: true })).toBeVisible();
    await page.getByPlaceholder('Add a title (optional)', { exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'What would you like to share with the community?', exact: true }).fill('Staging browser regression content.');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const article = page.getByRole('article').filter({ hasText: title });
    await expect(article).toBeVisible();
    await article.getByRole('button', { name: 'React', exact: true }).click();
    await expect(article.getByRole('button', { name: '1 reaction', exact: true })).toBeVisible();
    await article.getByRole('button', { name: 'Comment', exact: true }).click();
    await article.getByPlaceholder('Write a comment...', { exact: true }).fill(comment);
    await article.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(article.getByText(comment, { exact: true })).toBeVisible();
    await page.reload();
    await expect(article).toBeVisible();
    await expect(article.getByRole('button', { name: '1 reaction', exact: true })).toBeVisible();
    await article.getByRole('button', { name: '1', exact: true }).last().click();
    await expect(article.getByText(comment, { exact: true })).toBeVisible();
  });
});
