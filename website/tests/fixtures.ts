import { test as base, expect } from '@playwright/test';

// Exercise our loader without generating Analytics traffic for automated visits.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://www.googletagmanager.com/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('https://*.google-analytics.com/**', route => route.fulfill({ status: 204, body: '' }));
    await use(page);
  },
});
export { expect };
