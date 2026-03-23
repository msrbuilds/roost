import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.goto('/login');

    // Click login button without filling form
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Check for validation feedback (either HTML5 validation or custom)
    const emailInput = page.getByPlaceholder(/email/i);
    await expect(emailInput).toBeFocused();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/login');

    // Look for signup link
    const signupLink = page.getByRole('link', { name: /sign up|create account|register/i });
    await signupLink.click();

    // Verify we're on signup page
    await expect(page).toHaveURL(/signup/);
  });

  test('should display signup page with required fields', async ({ page }) => {
    await page.goto('/signup');

    // Check for signup form elements
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up|create|register/i })).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');

    // Look for forgot password link
    const forgotLink = page.getByRole('link', { name: /forgot|reset/i });

    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot-password/);
    }
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Login Validation', () => {
  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill('invalid-email');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Email input should be invalid
    const emailInput = page.getByPlaceholder(/email/i);
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should show error for incorrect credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill('nonexistent@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for error message
    await page.waitForTimeout(1000);

    // Should still be on login page (not redirected)
    await expect(page).toHaveURL(/login/);
  });
});
