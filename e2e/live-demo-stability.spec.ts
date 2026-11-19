import { test, expect, type Page, type Request } from '@playwright/test';

const liveExpect = expect.configure({ timeout: 15000 });

async function expectStable(page: Page, label: string) {
  await page.waitForLoadState('networkidle', { timeout: 8000 });
  await liveExpect(page.locator('main .animate-spin')).toHaveCount(0);
  const reads: string[] = [];
  const record = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin === new URL(page.url()).origin && /^\/(rest\/v1|api)\//.test(url.pathname)) {
      reads.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  };
  page.on('request', record);
  const loadingFrames = await page.locator('main').first().evaluate(main => new Promise<number>(resolve => {
    let flashes = 0;
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('.animate-spin') || node.querySelector('.animate-spin'))) flashes++;
      }
    });
    observer.observe(main, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(flashes); }, 2200);
  }));
  page.off('request', record);
  expect.soft(loadingFrames, `${label}: idle content should not return to a spinner`).toBe(0);
  expect.soft(reads, `${label}: no unexplained requests after loading settles`).toEqual([]);
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: fits viewport`).toBe(true);
}

test.describe('live demo page stability', () => {
  test.skip(process.env.ROOST_DEMO_BROWSER_TESTS !== 'true', 'Requires the dedicated read-only demo');
  for (const width of [390, 1440]) {
    test(`pages and filters remain stable at ${width}px`, async ({ page }) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/login');
      await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
      await liveExpect(page.getByRole('heading', { name: 'Welcome back, Demo Explorer!' })).toBeVisible();

      const routes = ['/', '/explore', '/classrooms', '/classrooms/build-with-roost', '/classrooms/design-studio', '/classrooms/learning-lab', '/members', '/calendar', '/leaderboard', '/messages', '/roadmap', '/roadmap/all', '/showcase', '/profile', '/profile/maya', '/settings', '/guide'];
      const details = new Set<string>();
      for (const path of routes) {
        await test.step(path, async () => {
          await page.goto(path);
          await liveExpect(page.getByRole('note')).toContainText('Read-only demo');
          await expectStable(page, path);
          for (const href of await page.locator('main a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')!))) {
            if (/^\/(showcase|roadmap|post)\/[0-9a-f-]{36}$/.test(href)) details.add(href);
          }
          if (path === '/messages') {
            await page.getByRole('button', { name: /^M Maya Chen/ }).click();
            await liveExpect(page.getByText(/Welcome to the demo! This is an example direct conversation/)).toBeVisible();
            await expectStable(page, 'open conversation');
          }
          const placeholder = path === '/members' ? 'Search members...' : path === '/classrooms' ? 'Search classrooms...' : path.startsWith('/roadmap') ? 'Search requests...' : null;
          if (placeholder) {
            const search = page.getByPlaceholder(placeholder);
            await search.fill('qzxunmatched937');
            await liveExpect(page.getByRole('heading', { name: path === '/members' ? 'No members found' : path === '/classrooms' ? 'No classrooms found' : 'No requests found', exact: true })).toBeVisible();
            await expectStable(page, `${path} no results`);
            await search.fill('');
            await liveExpect(page.getByRole('heading', { name: /^No (members|classrooms|requests) found$/ })).toHaveCount(0);
            await expectStable(page, `${path} cleared search`);
          }
        });
      }
      // Feed cards open posts through a button, so use a real detail link after opening one.
      await page.goto('/explore');
      await page.getByRole('button', { name: 'View post', exact: true }).first().click();
      await liveExpect(page).toHaveURL(/\/post\//);
      await expectStable(page, 'post detail');
      for (const path of details) {
        await page.goto(path);
        await expectStable(page, path);
      }
      expect(errors).toEqual([]);
    });
  }
});
