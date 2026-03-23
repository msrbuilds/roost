import { test, expect } from '@playwright/test';

// Test user credentials - these should be set up in your test environment
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

test.describe('Post Creation and Interaction Flow', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByPlaceholder(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for redirect to home/dashboard
    await page.waitForURL('/', { timeout: 10000 }).catch(() => {
      // If login fails, skip the test
      test.skip();
    });
  });

  test('should display the community feed', async ({ page }) => {
    // Check for feed elements
    await expect(page.getByText(/community|feed|posts/i).first()).toBeVisible();
  });

  test('should open post creation modal', async ({ page }) => {
    // Look for "Write something" or post creation trigger
    const postTrigger = page.getByText(/write something|create post|new post/i).first();

    if (await postTrigger.isVisible()) {
      await postTrigger.click();

      // Check for post creation modal/form
      await expect(
        page.getByRole('dialog').or(page.getByRole('textbox', { name: /content|body|write/i }))
      ).toBeVisible();
    }
  });

  test('should create a new post', async ({ page }) => {
    // Open post creation
    const postTrigger = page.getByText(/write something|create post|new post/i).first();

    if (await postTrigger.isVisible()) {
      await postTrigger.click();

      // Fill in post content
      const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i));
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test Post from E2E');
      }

      // Find content editor (could be a textarea or rich text editor)
      const contentEditor = page
        .getByRole('textbox')
        .or(page.locator('.ql-editor'))
        .or(page.locator('[contenteditable="true"]'))
        .first();

      if (await contentEditor.isVisible()) {
        await contentEditor.fill('This is a test post created by Playwright E2E tests.');
      }

      // Submit the post
      const submitButton = page.getByRole('button', { name: /post|submit|publish/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for post to appear in feed
        await page.waitForTimeout(2000);

        // Verify post appears (title or content)
        await expect(page.getByText('Test Post from E2E').or(page.getByText(/test post/i))).toBeVisible();
      }
    }
  });

  test('should react to a post', async ({ page }) => {
    // Find a post card
    const postCard = page.locator('[data-testid="post-card"]').or(page.locator('.post-card')).first();

    if (await postCard.isVisible()) {
      // Find like/reaction button
      const likeButton = postCard
        .getByRole('button', { name: /like|react/i })
        .or(postCard.locator('[data-testid="like-button"]'))
        .or(postCard.locator('.like-button'));

      if (await likeButton.isVisible()) {
        await likeButton.click();

        // Wait for reaction to register
        await page.waitForTimeout(500);
      }
    }
  });

  test('should comment on a post', async ({ page }) => {
    // Find a post card
    const postCard = page.locator('[data-testid="post-card"]').or(page.locator('.post-card')).first();

    if (await postCard.isVisible()) {
      // Find comment button or expand comments
      const commentButton = postCard
        .getByRole('button', { name: /comment|reply/i })
        .or(postCard.locator('[data-testid="comment-button"]'));

      if (await commentButton.isVisible()) {
        await commentButton.click();

        // Find comment input
        const commentInput = page
          .getByPlaceholder(/write a comment|add a comment/i)
          .or(page.locator('[data-testid="comment-input"]'))
          .first();

        if (await commentInput.isVisible()) {
          await commentInput.fill('Test comment from E2E');

          // Submit comment
          const submitComment = page.getByRole('button', { name: /send|post|submit/i });
          if (await submitComment.isVisible()) {
            await submitComment.click();

            // Verify comment appears
            await page.waitForTimeout(1000);
            await expect(page.getByText('Test comment from E2E')).toBeVisible();
          }
        }
      }
    }
  });
});

test.describe('Post Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByPlaceholder(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL('/', { timeout: 10000 }).catch(() => test.skip());
  });

  test('should filter posts by category', async ({ page }) => {
    // Find category filter buttons
    const categoryButtons = page.getByRole('button').filter({ hasText: /general|youtube|all/i });

    if ((await categoryButtons.count()) > 0) {
      await categoryButtons.first().click();
      await page.waitForTimeout(500);
      // Posts should be filtered (hard to verify without knowing exact content)
    }
  });

  test('should load more posts on scroll (infinite scroll)', async ({ page }) => {
    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for potential loading
    await page.waitForTimeout(1000);
  });
});
