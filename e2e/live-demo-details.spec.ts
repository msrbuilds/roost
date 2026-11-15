import { test, expect, type Page } from '@playwright/test';

// Live requests include authentication and remote database reads.
const liveExpect = expect.configure({ timeout: 15000 });

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await liveExpect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
}

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), page.url()).toBe(true);
}

test.describe('shared demo feature details', () => {
  test.use({ actionTimeout: 20000 });
  test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires the dedicated live demo');
  for (const width of [390, 1440]) {
    test(`search, profiles, discussions, projects, roadmap, and guide at ${width}px`, async ({ page }) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(`${page.url()}: ${error.message} ${error.stack || ''}`));
      await login(page);

      if (width < 768) await page.getByRole('button', { name: 'Open search', exact: true }).click();
      const search = page.getByPlaceholder('Search members, posts, classrooms...').filter({ visible: true });
      await search.fill('qzxunmatched937');
      await liveExpect(page.getByText('No results found for "qzxunmatched937"')).toBeVisible();
      await search.fill('Maya');
      await page.getByRole('button', { name: 'Maya Chen @maya', exact: true }).click();
      await liveExpect(page.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
      await liveExpect(page.getByRole('button', { name: 'Following', exact: true }).first()).toBeDisabled();
      for (const tab of ['Point Activity', 'Followers', 'Following', 'Posts']) {
        await page.getByRole('button', { name: new RegExp(`^${tab}\\s*\\d*$`) }).last().click();
        await fits(page);
      }

      await page.goto('/members');
      await page.getByPlaceholder('Search members...').fill('qzxunmatched937');
      await liveExpect(page.getByRole('heading', { name: 'No members found' })).toBeVisible();
      await page.getByPlaceholder('Search members...').fill('Maya');
      await liveExpect(page.locator('main a[href="/profile/maya"]').first()).toBeVisible();
      await page.getByPlaceholder('Search members...').fill('');
      await page.getByRole('combobox').last().selectOption('alphabetical');
      await liveExpect(page.locator('main a[href="/profile/alex"]').first()).toBeVisible();

      await page.goto('/classrooms');
      await page.getByPlaceholder('Search classrooms...').fill('Build');
      await liveExpect(page.locator('main a.card')).toHaveCount(1);
      await liveExpect(page.getByRole('button', { name: 'Leave Classroom', exact: true })).toBeDisabled();
      await page.getByPlaceholder('Search classrooms...').fill('');
      await page.getByRole('button', { name: 'My Classrooms (3)', exact: true }).click();
      await liveExpect(page.locator('main a.card')).toHaveCount(3);

      await page.goto('/explore');
      await page.getByRole('button', { name: 'View post', exact: true }).first().click();
      await liveExpect(page).toHaveURL(/\/post\//);
      await liveExpect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
      await liveExpect(page.locator('main article')).toHaveCount(1);
      await liveExpect(page.getByRole('heading', { name: 'Welcome to a community that feels like home', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await liveExpect(page.getByText('Comments are read-only in this demo.')).toBeVisible();
      await fits(page);

      await page.goto('/showcase');
      await liveExpect(page.getByRole('link', { name: /Submit Project/ })).toHaveCount(0);
      await page.getByText('Roost: a place for your people', { exact: true }).first().click();
      await liveExpect(page).toHaveURL(/\/showcase\/[a-f0-9-]+/);
      await page.getByRole('button', { name: /^Reviews/ }).click();
      await liveExpect(page.getByPlaceholder(/review/i)).toHaveCount(0);
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      await fits(page);

      await page.goto('/roadmap');
      await page.getByPlaceholder('Search requests...').fill('qzxunmatched937');
      await liveExpect(page.getByRole('heading', { name: 'No requests found', exact: true })).toBeVisible();
      await page.getByPlaceholder('Search requests...').fill('');
      await page.getByText('A home for every learning journey', { exact: true }).first().click();
      await liveExpect(page).toHaveURL(/\/roadmap\/[a-f0-9-]+/);
      await liveExpect(page.getByRole('heading', { name: 'Discussion (0)' })).toBeVisible();
      await liveExpect(page.getByPlaceholder('Share your thoughts...')).toHaveCount(0);
      await fits(page);

      await page.goto('/leaderboard');
      for (const period of ['7 Days', '30 Days', 'All Time']) {
        await page.getByRole('button', { name: period, exact: true }).click();
        await liveExpect(page.getByText('Maya Chen', { exact: true }).first()).toBeVisible();
        await fits(page);
      }
      await page.goto('/guide');
      for (const section of ['Getting Started', 'Creating Posts', 'Direct Messaging', 'Events & Calendar', 'Leaderboard & Points', 'Notifications', 'Member Directory']) {
        await page.locator('main').getByRole('button', { name: section, exact: true }).click();
        await liveExpect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
        await fits(page);
      }
      for (const image of await page.locator('main img').all()) {
        await image.scrollIntoViewIfNeeded();
        await liveExpect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      expect(errors).toEqual([]);
    });

    test(`navigation, notifications, settings, calendar, and read-only controls at ${width}px`, async ({ page }) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      const denied: string[] = [];
      page.on('pageerror', error => errors.push(`${page.url()}: ${error.message} ${error.stack || ''}`));
      page.on('response', response => {
        if (response.url().startsWith('https://roost-demo.msrbuilds.com/') && response.status() === 403) denied.push(response.url());
      });
      await login(page);
      if (width < 1024) {
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        const menu = page.getByRole('navigation', { name: 'Mobile navigation' });
        await liveExpect(menu.getByRole('link', { name: 'Roadmap & Issues', exact: true })).toBeVisible();
        await liveExpect(menu.getByRole('link', { name: 'Live Room', exact: true })).toHaveCount(0);
        await menu.getByRole('link', { name: 'Roadmap & Issues', exact: true }).click();
        await liveExpect(menu).toHaveCount(0);
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await page.keyboard.press('Escape');
        await liveExpect(menu).toHaveCount(0);
      } else {
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      await liveExpect(page.locator('html')).toHaveClass(/dark/);
      await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();

      await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await liveExpect(page.getByRole('button', { name: 'Mark all read', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: /^New message from Maya Chen/ }).click();
      await liveExpect(page).toHaveURL(/\/messages/);
      await liveExpect(page.getByRole('heading', { name: 'Notifications', exact: true })).toHaveCount(0);
      const conversation = page.getByRole('button', { name: /^M Maya Chen/ });
      if (await conversation.isVisible()) await conversation.click();
      await liveExpect(page.getByText(/Welcome to the demo! This is an example direct conversation/)).toBeVisible();
      await liveExpect(page.getByPlaceholder('Read-only demo conversation')).toBeDisabled();
      await liveExpect(page.getByRole('button', { name: 'Attach images', exact: true })).toBeDisabled();
      await liveExpect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
      await fits(page);

      await page.goto('/settings');
      await liveExpect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled();
      await liveExpect(page.getByRole('textbox', { name: 'Display Name', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Account', exact: true }).click();
      for (const name of ['Change Password', 'Enable 2FA', 'Delete Account']) await liveExpect(page.getByRole('button', { name, exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Subscription', exact: true }).click();
      await liveExpect(page.getByRole('heading', { name: 'Subscription Status', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Notifications', exact: true }).last().click();
      await liveExpect(page.getByRole('button', { name: 'Save Preferences', exact: true })).toBeDisabled();
      await fits(page);

      await page.goto('/calendar');
      await liveExpect(page.getByRole('button', { name: 'Create Event', exact: true })).toBeDisabled();
      for (const view of ['Week', 'Day', 'Agenda', 'Month']) {
        await page.getByRole('button', { name: view, exact: true }).click();
        await fits(page);
        if (view === 'Agenda') {
          const event = page.getByRole('button', { name: 'Community co-working \u00b7 example event', exact: true });
          await liveExpect(event).toBeVisible();
          expect(await page.locator('.rbc-agenda-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
          await event.click();
          await liveExpect(page.getByRole('dialog', { name: 'Community co-working \u00b7 example event' })).toBeVisible();
          await page.keyboard.press('Escape');
          await liveExpect(page.getByRole('dialog')).toHaveCount(0);
        }
      }
      const request = page.waitForRequest(request => {
        const url = new URL(request.url());
        return url.pathname === '/rest/v1/events' && url.searchParams.get('start_time')?.startsWith('gte.') === true;
      });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await request;
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.getByRole('button', { name: 'Going', exact: true }).waitFor();
      for (const name of ['Going', 'Maybe', "Can't Go"]) await liveExpect(page.getByRole('button', { name, exact: true })).toBeDisabled();
      await page.getByLabel('Group', { exact: true }).selectOption({ label: 'Design Studio' });
      await fits(page);
      if (width === 390) {
        await page.setViewportSize({ width: 320, height: 900 });
        for (const view of ['Month', 'Week', 'Day', 'Agenda']) {
          await page.getByRole('button', { name: view, exact: true }).click();
          await fits(page);
          if (view === 'Agenda') expect(await page.locator('.rbc-agenda-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
      }
      await page.getByRole('button', { name: 'Account menu', exact: true }).click();
      const logout = page.waitForRequest(request => new URL(request.url()).pathname === '/auth/v1/logout');
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      expect(new URL((await logout).url()).searchParams.get('scope')).toBe('local');
      await liveExpect(page.getByRole('button', { name: 'Explore the demo', exact: true })).toBeVisible();
      await login(page);
      expect({ errors, denied }).toEqual({ errors: [], denied: [] });
    });
  }
});
