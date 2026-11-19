import { test, expect } from '@playwright/test';

// Explicit opt-in: these checks use the public, read-only demo rather than mocked data.
test.describe('public read-only demo', () => {
  test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires an explicitly selected live demo');
  for (const width of [390, 1440]) {
    test(`showcase stays stable after loading and clearing search at ${width}px`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible({ timeout: 15000 });
      await page.goto('/showcase');
      const project = page.getByRole('heading', { name: 'Roost: a place for your people', exact: true });
      await expect(project).toBeVisible({ timeout: 15000 });

      async function expectStableProject() {
        const reads: string[] = [];
        const record = (request: import('@playwright/test').Request) => {
          if (new URL(request.url()).pathname === '/rest/v1/showcases') reads.push(request.url());
        };
        page.on('request', record);
        // Observe across several debounce intervals, rather than checking a lucky frame.
        const removed = await project.evaluate(node => new Promise<boolean>(resolve => {
          let detached = false;
          const observer = new MutationObserver(() => { detached ||= !node.isConnected; });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => { observer.disconnect(); resolve(detached); }, 1800);
        }));
        page.off('request', record);
        expect(removed, 'the project must not be replaced with a loading spinner').toBe(false);
        expect(reads, 'an idle showcase must not repeatedly refetch').toEqual([]);
      }
      await expectStableProject();
      if (width < 768) await page.getByRole('button', { name: 'Filters', exact: true }).click();
      const search = page.getByPlaceholder('Search projects...');
      await search.fill('qzxunmatched937');
      await expect(page.getByRole('heading', { name: 'No projects found', exact: true })).toBeVisible({ timeout: 15000 });
      await search.fill('');
      if (width < 768) await page.getByRole('button', { name: 'Hide filters', exact: true }).click();
      await expect(project).toBeVisible({ timeout: 15000 });
      await expectStableProject();
    });

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
        if (path === '/classrooms') {
          const card = page.locator('a.card').filter({ has: page.getByRole('heading', { name: 'Build with Roost', exact: true }) });
          const icon = await card.getByText('B', { exact: true }).boundingBox();
          const title = await card.getByRole('heading', { name: 'Build with Roost', exact: true }).boundingBox();
          expect(icon!.y + icon!.height).toBeLessThanOrEqual(title!.y);
          expect(await card.locator('h3').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
      }
      await page.goto('/classrooms/build-with-roost');
      await page.getByRole('button', { name: /^Start here Your first steps/ }).click();
      await page.getByRole('button', { name: /^Welcome to your learning space/ }).filter({ visible: true }).first().click();
      await expect(page.locator('iframe[title="Welcome to your learning space"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Read-only', exact: true })).toBeDisabled();
      await expect(page.getByText(/Lessons, progress, and discussion live together here/)).not.toContainText('<p>');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto('/messages');
      await page.getByRole('button', { name: /^M Maya Chen/ }).click();
      await expect(page.getByText(/Welcome to the demo! This is an example direct conversation/)).toBeVisible();
      await expect(page.getByText('Failed to load messages', { exact: true })).toHaveCount(0);
      await page.goto('/admin');
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();
    });
  }
});
