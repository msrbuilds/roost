import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { guides } from '../src/data/site';

test('technology icons clear hero content and the feature screenshots stay in landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 500, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.faq-section h2')).toHaveText(/A few things\s+worth knowing\./);
    const icons = page.locator('.hero-tech');
    await expect(icons).toHaveCount(6);
    if (width <= 600) expect(await icons.evaluateAll(items => new Set(items.map(item => Math.round(item.getBoundingClientRect().top))).size)).toBe(1);
    expect(await icons.evaluateAll(elements => {
      const content = [...document.querySelectorAll('.hero-description, .hero-copy .button-row > a, .hero-proof > span, .hero-cost-note')].map(el => el.getBoundingClientRect());
      const heading = document.createRange();
      heading.selectNodeContents(document.querySelector('.hero-copy h1')!);
      content.push(...[...heading.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0));
      return elements.every(el => {
        const icon = el.querySelector('.hero-tech-card')!.getBoundingClientRect();
        return content.every(text => icon.right <= text.left || icon.left >= text.right || icon.bottom <= text.top || icon.top >= text.bottom);
      });
    }), `technology icons clear hero text and actions at ${width}px`).toBe(true);
    if (width >= 1280) {
      expect(await page.locator('.hero-copy').evaluate(hero => {
        const actions = hero.querySelector('.button-row')!.getBoundingClientRect();
        const tailwind = hero.querySelector('.hero-tech-tailwindcss .hero-tech-card')!.getBoundingClientRect();
        const docker = hero.querySelector('.hero-tech-docker .hero-tech-card')!.getBoundingClientRect();
        const first = hero.querySelector('.button-row > a')!.getBoundingClientRect();
        const last = hero.querySelector('.button-row > a:last-child')!.getBoundingClientRect();
        const pairs = [['react', 'typescript'], ['supabase', 'nodejs'], ['tailwindcss', 'docker']].map(pair => pair.map(name => hero.querySelector(`.hero-tech-${name} .hero-tech-card`)!.getBoundingClientRect()));
        const mid = hero.getBoundingClientRect().left + hero.getBoundingClientRect().width / 2;
        const centers = pairs.map(pair => pair.map(rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })));
        const symmetric = centers.every(pair => Math.abs((pair[0].x + pair[1].x) / 2 - mid) < 1 && Math.abs(pair[0].y - pair[1].y) < 1);
        const evenlySpaced = Math.abs((centers[1][0].y - centers[0][0].y) - (centers[2][0].y - centers[1][0].y)) < 1 && Math.abs((centers[1][0].x - centers[0][0].x) - (centers[2][0].x - centers[1][0].x)) < 1;
        return symmetric && evenlySpaced && tailwind.right < first.left && first.left - tailwind.right < 100 && docker.left > last.right && docker.left - last.right < 100 && tailwind.top < actions.bottom && tailwind.bottom > actions.top && docker.top < actions.bottom && docker.bottom > actions.top;
      }), `Tailwind and Docker flank the CTAs at ${width}px`).toBe(true);
    }
    for (const image of await icons.locator('img').all()) {
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await page.getByRole('tablist', { name: 'Product screenshots' }).getByRole('tab', { name: 'Calendar', exact: true }).click();
    const calendar = page.locator('#tour-panel-calendar');
    await calendar.scrollIntoViewIfNeeded();
    const image = calendar.locator('img:visible');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth / img.naturalHeight > 1.5)).toBe(true);
    const frame = await image.boundingBox();
    expect(frame!.width / frame!.height).toBeGreaterThan(1.4);
    await expect(page.locator('[data-screenshot-tour]')).toHaveCount(1);
    await expect(page.locator('.calendar-preview, .admin-preview')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('hero logos float gently and stop for keyboard focus or reduced motion', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const icons = page.locator('.hero-tech');
    await expect.poll(() => icons.evaluateAll(items => items.every(item => getComputedStyle(item).opacity === '1'))).toBe(true);
    expect(await icons.evaluateAll(items => items.every(item => item.getAnimations({ subtree: true }).some(animation => {
      const timing = animation.effect!.getComputedTiming();
      return timing.iterations === Infinity && Number(timing.duration) >= 8000 && animation.playState === 'running';
    })))).toBe(true);
    const first = icons.first().locator('.hero-tech-card');
    const initialTransform = await first.evaluate(item => getComputedStyle(item).transform);
    await expect.poll(() => first.evaluate(item => getComputedStyle(item).transform)).not.toBe(initialTransform);
    await page.locator('#technology-heading').scrollIntoViewIfNeeded();
    await expect(first).toHaveCSS('animation-play-state', 'paused');
    await page.locator('.hero-copy h1').scrollIntoViewIfNeeded();
    await expect.poll(() => first.evaluate(item => item.getAnimations().some(animation =>
      animation.effect!.getComputedTiming().iterations === Infinity && animation.playState === 'running'
    ))).toBe(true);
    await page.locator('.hero-copy .button-row > a').first().focus();
    await expect(first).toHaveCSS('animation-play-state', 'paused');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const icon of await icons.all()) {
      await expect(icon).toHaveCSS('animation-name', 'none');
      await expect(icon).toHaveCSS('opacity', '1');
      await expect(icon.locator('.hero-tech-card')).toHaveCSS('animation-name', 'none');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('the full stack and integrations remain readable and link to setup guides', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [320, 390, 600, 768, 1000, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const section = page.locator('#technology');
    expect(await section.evaluate(el => el.nextElementSibling?.classList.contains('faq-section'))).toBe(true);
    await expect(section.locator('.tech-node')).toHaveCount(12);
    await expect(section.getByText('OPTIONAL · OFF BY DEFAULT', { exact: true })).toBeVisible();
    await expect(section).toContainText('Optional caching');
    const columns = width <= 600 ? 3 : width <= 1000 ? 4 : 6;
    expect(await section.locator('.tech-node').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationDelay)))
      .toEqual(Array.from({ length: 12 }, (_, index) => `${Math.round((index % columns) * 6) / 100}s`));
    for (const link of await section.locator('.tech-integration .text-link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (const img of await section.locator('img').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const link of await page.locator('#technology a').all()) {
    expect((await request.get((await link.getAttribute('href'))!)).ok()).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const first = page.locator('.tech-node').first();
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute('data-revealed', '');
  await expect.poll(() => first.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const last = page.locator('.tech-node').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute('data-revealed', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(last).toHaveCSS('opacity', '1');
  await expect(last).toHaveCSS('animation-name', 'none');
});

test('stack motion responds when the visitor changes their motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const flow = page.locator('.tech-flow');
  await flow.scrollIntoViewIfNeeded();
  await expect(flow).toHaveAttribute('data-tech-active', '');
  const signal = flow.locator('.tech-flow-connector').first();
  await expect.poll(() => signal.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => signal.evaluate(el => getComputedStyle(el, '::after').animationPlayState)).toBe('running');
  await page.locator('.tech-integration .text-link').first().focus();
  await expect.poll(() => signal.evaluate(el => getComputedStyle(el, '::after').animationPlayState)).toBe('paused');
  await expect(page.locator('.tech-integration').first()).toHaveCSS('opacity', '1');
});

test('the technology section stays visible without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const section = page.locator('#technology');
    await expect(section.locator('.tech-node')).toHaveCount(12);
    for (const node of await section.locator('.tech-node').all()) await expect(node).toHaveCSS('opacity', '1');
    await expect(section.getByRole('link', { name: 'Choose your setup' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('intro video waits for activation and preserves its frame on desktop and mobile', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => {
    if (/youtube|ytimg|googlevideo/.test(new URL(request.url()).hostname)) requests.push(request.url());
  });
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Video player</title></head><body><main aria-label="Video player controls">Roost video player</main></body></html>',
  }));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    requests.length = 0;
    await page.goto('/');
    const video = page.getByRole('region', { name: 'Meet Roost', exact: true });
    const play = video.getByRole('button', { name: 'Watch the Roost intro video', exact: true });
    await expect(play).toBeEnabled();
    await expect.poll(() => play.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(video.locator('iframe')).toHaveCount(0);
    await expect(page.locator('[data-showcase-slider]')).toHaveCount(0);
    expect(requests).toEqual([]);
    const before = await video.locator('[data-video-stage]').boundingBox();
    await play.press(width < 800 ? 'Space' : 'Enter');
    const frame = video.locator('iframe');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/XVmHSLuBeNU?autoplay=1&rel=0&playsinline=1');
    await expect(frame).toHaveAttribute('title', 'Roost introduction video');
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    await expect(frame).toHaveAttribute('allowfullscreen', '');
    await expect(frame).toBeFocused();
    const after = await video.locator('[data-video-stage]').boundingBox();
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
    const player = await frame.boundingBox();
    expect(player!.width).toBeGreaterThanOrEqual(200);
    expect(player!.height).toBeGreaterThanOrEqual(200);
    expect(requests.some(url => url.includes('/embed/XVmHSLuBeNU'))).toBe(true);
    await expect(video.getByRole('link', { name: 'Watch on YouTube', exact: true })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=XVmHSLuBeNU');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('intro video offers a direct watch link without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const video = page.getByRole('region', { name: 'Meet Roost', exact: true });
    await expect(video.getByRole('button', { name: 'Watch the Roost intro video', exact: true })).toBeDisabled();
    await expect(video.locator('iframe')).toHaveCount(0);
    const link = video.getByRole('link', { name: 'Watch on YouTube', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=XVmHSLuBeNU');
    await expect(link).toHaveAttribute('target', '_blank');
  } finally { await context.close(); }
});

test('intro video keeps the watch link available if the embedded player is blocked', async ({ page }) => {
  await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
  await page.goto('/');
  const video = page.getByRole('region', { name: 'Meet Roost', exact: true });
  await video.getByRole('button', { name: 'Watch the Roost intro video', exact: true }).click();
  await expect(video.locator('iframe')).toHaveCount(1);
  await expect(video.getByRole('link', { name: 'Watch on YouTube', exact: true })).toBeVisible();
  await expect(video.getByRole('status')).toContainText('watch on YouTube');
});

test('logo marquee can pause and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  const marquee = page.locator('[data-logo-marquee]');
  await expect(marquee.locator('.alternatives-heading button')).toHaveCount(0);
  await marquee.getByRole('button', { name: 'Pause scrolling logos' }).click();
  await expect(marquee).toHaveAttribute('data-paused', '');
  await expect(marquee.locator('.alternatives-track')).toHaveCSS('animation-play-state', 'paused');
  await marquee.getByRole('button', { name: 'Resume scrolling logos' }).click();
  await expect(marquee).not.toHaveAttribute('data-paused');
  await expect(marquee.locator('ul:not([aria-hidden]) li')).toHaveCount(6);
  await expect(marquee.locator('.alternatives-group[aria-hidden="true"] a, .alternatives-group[aria-hidden="true"] button')).toHaveCount(0);
  for (const image of await marquee.locator('img').all()) {
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(marquee.locator('.alternatives-track')).toHaveCSS('animation-name', 'none');
  await expect(marquee.locator('[data-marquee-pause]')).toBeDisabled();
});

test('the feature tour keeps its current screenshot until the next one loads', async ({ page }) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
  let imageRequested = false;
  await page.route(/\/_astro\/classrooms\..*\.webp$/, async route => {
    imageRequested = true;
    await imageGate;
    await route.continue();
  });
  try {
    await page.goto('/features/');
    const tabs = page.getByRole('tablist', { name: 'Product screenshots' });
    await tabs.getByRole('tab', { name: 'Classrooms', exact: true }).click();
    await expect.poll(() => imageRequested).toBe(true);
    await expect(tabs.getByRole('tab', { name: 'Community feed', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tour-panel-feed')).toBeVisible();
    releaseImage();
    await expect(tabs.getByRole('tab', { name: 'Classrooms', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.locator('#tour-panel-classrooms img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  } finally {
    releaseImage();
  }
});

// Exercise the real production policy locally, where astro preview does not
// apply Cloudflare's _headers file. Deployed-site runs use actual HTTP headers.
const csp = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  .split('\n').find((line) => line.trim().startsWith('Content-Security-Policy:'))!
  .trim().slice('Content-Security-Policy:'.length).trim();
test.beforeEach(async ({ page, baseURL }) => {
  if (baseURL?.startsWith('http://127.0.0.1:')) {
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
  }
});

test('product, features, and docs fit desktop and mobile widths', async ({ page }) => {
  test.setTimeout(90000);
  const routes = ['/', '/features/', '/compare/', '/docs/', '/privacy/', '/this-page-does-not-exist/', ...guides.map(({ id }) => `/docs/${id}/`)];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(route === '/this-page-does-not-exist/' ? 404 : 200);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  if (process.env.ROOST_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, 'roost-product-mobile.png'), fullPage: true });
  }
});

test('section rails and card grids share single aligned borders at responsive breakpoints', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 600, 768, 800, 801, 1000, 1150, 1151, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/features/', '/docs/']) {
      await page.goto(route);
      const problems = await page.evaluate(() => {
        const problems: string[] = [];
        const number = (value: string) => parseFloat(value) || 0;
        const rail = document.querySelector('.header-inner')!.getBoundingClientRect();
        document.querySelectorAll('main > section.container, .belief-strip > .container, .ownership-grid, .docs-help, .footer-top, .footer-bottom').forEach(element => {
          const rect = element.getBoundingClientRect();
          if (Math.abs(rect.left - rail.left) > .1 || Math.abs(rect.right - rail.right) > .1) problems.push(`${element.className}: outer rails drift`);
        });
        document.querySelectorAll('.feature-grid, .feature-detail-grid, .steps-grid, .choice-section, .tech-core-grid, .tech-integration-grid').forEach(grid => {
          const style = getComputedStyle(grid);
          const rect = grid.getBoundingClientRect();
          const cells = [...grid.children].map(element => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) }));
          const markers = (cell: typeof cells[number], pseudo: '::before' | '::after') => {
            const mark = getComputedStyle(cell.element, pseudo);
            if (mark.content === 'none' || mark.backgroundImage === 'none') problems.push(`${grid.className}: missing intersection squares`);
            const radius = number(mark.height) / 2;
            return {
              left: cell.rect.left + number(cell.style.borderLeftWidth) + number(mark.left) + radius,
              right: cell.rect.right - number(cell.style.borderRightWidth) - number(mark.right) - radius,
              y: pseudo === '::before'
                ? cell.rect.top + number(cell.style.borderTopWidth) + number(mark.top) + radius
                : cell.rect.bottom - number(cell.style.borderBottomWidth) - number(mark.bottom) - radius,
            };
          };
          const aligned = (a: number, b: number) => {
            if (Math.abs(a - b) > .1) problems.push(`${grid.className}: intersection squares drift by ${Math.abs(a - b)}px`);
          };
          const left = rect.left + number(style.borderLeftWidth);
          const right = rect.right - number(style.borderRightWidth);
          const bottom = rect.bottom - number(style.borderBottomWidth);
          const check = (label: string, thickness: number) => {
            if (Math.abs(thickness - 1) > .05) problems.push(`${grid.className}: ${label} is ${thickness}px`);
          };
          for (const cell of cells) {
            if (Math.abs(cell.rect.left - left) < .1) check('left perimeter', number(style.borderLeftWidth) + number(cell.style.borderLeftWidth));
            if (Math.abs(cell.rect.right - right) < .1) check('right perimeter', number(style.borderRightWidth) + number(cell.style.borderRightWidth));
            if (Math.abs(cell.rect.bottom - bottom) < .1) check('bottom perimeter', number(style.borderBottomWidth) + number(cell.style.borderBottomWidth));
            const next = cells.find(other => Math.abs(other.rect.top - cell.rect.top) < .1 && Math.abs(other.rect.left - cell.rect.right - number(style.columnGap)) < .1);
            if (next) {
              check('column divider', number(cell.style.borderRightWidth) + number(next.style.borderLeftWidth) + number(style.columnGap));
              aligned(markers(cell, '::before').right, markers(next, '::before').left);
              aligned(markers(cell, '::after').right, markers(next, '::after').left);
            }
            const below = cells.find(other => Math.abs(other.rect.left - cell.rect.left) < .1 && Math.abs(other.rect.top - cell.rect.bottom - number(style.rowGap)) < .1);
            if (below) {
              check('row divider', number(cell.style.borderBottomWidth) + number(below.style.borderTopWidth) + number(style.rowGap));
              aligned(markers(cell, '::after').y, markers(below, '::before').y);
            }
          }
          const parentMark = getComputedStyle(grid, '::after');
          if (parentMark.content !== 'none' && parentMark.backgroundImage !== 'none') {
            const parentCorners = markers({ element: grid, rect, style }, '::after');
            for (const cell of cells.filter(cell => Math.abs(cell.rect.bottom - bottom) < .1)) {
              aligned(markers(cell, '::after').y, parentCorners.y);
            }
          }
        });
        return problems;
      });
      expect(problems, `${route} at ${width}px`).toEqual([]);
    }
  }
});

test('public pages expose consistent crawl controls, metadata, and sitemap coverage', async ({ request }) => {
  const origin = 'https://roost.msrbuilds.com';
  const routes = ['/', '/features/', '/docs/', '/compare/', '/privacy/', ...guides.map(({ id }) => `/docs/${id}/`)];
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap-index.xml`);
  expect(await robots.text()).not.toMatch(/^Disallow:\s*\/\s*$/m);
  const index = await request.get('/sitemap-index.xml');
  expect(index.ok()).toBe(true);
  const sitemapURL = (await index.text()).match(/<loc>([^<]+)<\/loc>/)![1];
  const sitemap = await request.get(new URL(sitemapURL).pathname);
  expect(sitemap.ok()).toBe(true);
  const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const titles: string[] = [];
  const descriptions: string[] = [];
  for (const route of routes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['x-robots-tag'] || '').not.toMatch(/noindex/i);
    const html = await response.text();
    expect(html).not.toMatch(/name="robots"[^>]+content="[^"]*noindex/);
    expect(html).toContain(`rel="canonical" href="${origin}${route}"`);
    expect(locations, route).toContain(`${origin}${route}`);
    titles.push(html.match(/<title>([^<]+)<\/title>/)![1]);
    descriptions.push(html.match(/name="description" content="([^"]+)"/)![1]);
  }
  expect(new Set(titles).size).toBe(routes.length);
  expect(new Set(descriptions).size).toBe(routes.length);
  expect(locations.some(location => location.includes('404'))).toBe(false);
  const missing = await request.get('/quality-audit-missing-page/');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('content="noindex,follow"');
});

test('navigation closes with Escape and resets when switching to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.menu-trigger');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
  await toggle.click();
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).toBeHidden();
  await page.goto('/docs/self-hosted-setup/');
  const docsToggle = page.locator('.docs-menu-toggle');
  await docsToggle.click();
  await expect(page.locator('#docs-sidebar')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(docsToggle).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#docs-sidebar')).toBeHidden();
  await docsToggle.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#docs-sidebar')).toBeHidden();
  await expect(docsToggle).toBeFocused();
});

test('guide navigation keeps previous and next directions at the first and last guide', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/docs/${guides[0].id}/`);
    const pager = page.getByRole('navigation', { name: 'Previous and next guide' });
    await expect(pager.locator('[rel="prev"]')).toHaveCount(0);
    const next = pager.getByRole('link', { name: /Next/ });
    await expect(next).toHaveCSS('text-align', 'right');
    await next.click();
    await expect(page).toHaveURL(new RegExp(`/docs/${guides[1].id}/$`));
    await page.goto(`/docs/${guides.at(-1)!.id}/`);
    await expect(pager.locator('[rel="next"]')).toHaveCount(0);
    const previous = pager.getByRole('link', { name: /Previous/ });
    await expect(previous).toHaveCSS('text-align', 'left');
    await previous.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/docs/${guides.at(-2)!.id}/$`));
  }
});

test('keyboard search handles no results and restores focus', async ({ page }) => {
  await page.goto('/features/');
  const trigger = page.getByRole('button', { name: /^Search documentation/ });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('searchbox', { name: 'Search documentation', exact: true });
  await expect(input).toBeFocused();
  await input.fill('qzxwvplm937248');
  await expect(page.locator('#search-status')).toContainText('No results.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('copying remains possible when clipboard permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('/docs/backups/');
  const box = page.locator('.code-block').first();
  const code = await box.locator('code').textContent();
  await box.getByRole('button', { name: 'Copy code to clipboard', exact: true }).click();
  await expect(box.locator('button')).toHaveText('Code selected');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(code);
});

test('product screenshots load and missing pages offer recovery links', async ({ page }) => {
  test.setTimeout(180000);
  // Inspect stationary assets; motion behavior has its own carousel tests.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/features/']) {
      await page.goto(route);
      for (const image of await page.locator('main img:visible').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
      if (route === '/') {
        const video = page.getByRole('region', { name: 'Meet Roost', exact: true });
        await expect(video.getByRole('button', { name: 'Watch the Roost intro video', exact: true })).toBeVisible();
        await expect(video.locator('iframe')).toHaveCount(0);
      } else {
        await expect(page.locator('main > section').last()).toHaveClass(/final-cta/);
        expect(await page.locator('.feature-detail').evaluateAll((cards) => {
          const rows = new Map<number, number[]>();
          for (const card of cards) {
            const row = Math.round(card.getBoundingClientRect().top);
            const dividers = rows.get(row) || [];
            dividers.push(card.querySelector('.check-list')!.getBoundingClientRect().top);
            rows.set(row, dividers);
          }
          return [...rows.values()].every((tops) => Math.max(...tops) - Math.min(...tops) <= 1);
        }), `feature checklist rows align at ${width}px`).toBe(true);
      }
      const cta = page.locator('.final-cta');
      expect(await cta.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const button = element.querySelector('.button')!.getBoundingClientRect();
        return button.left >= box.left && button.right <= box.right && button.top >= box.top && button.bottom <= box.bottom;
      }), `${route} CTA fits at ${width}px`).toBe(true);
      if (process.env.ROOST_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        const name = route === '/' ? 'home' : 'features';
        await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, `${name}-${width}-full.png`), fullPage: true });
        const sections = await page.locator('main > section').all();
        for (const [index, section] of sections.entries()) {
          await section.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, `${name}-${width}-section-${index}.png`) });
        }
      }
    }
  }
  const response = await page.goto('/this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('This perch is');
  await page.getByRole('link', { name: 'Browse the docs →', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/$/);
});

test('live demo calls to action and the real screenshot tour work with pointer and keyboard', async ({ page }) => {
  test.setTimeout(120000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/features/']) {
      await page.goto(path);
      const demoLinks = page.getByRole('link', { name: 'Try Live Demo', exact: true });
      expect(await demoLinks.count()).toBeGreaterThan(0);
      for (const link of await demoLinks.all()) await expect(link).toHaveAttribute('href', 'https://roost-demo.msrbuilds.com');
      const tabs = page.getByRole('tablist', { name: 'Product screenshots' }).getByRole('tab');
      await expect(tabs).toHaveCount(12);
      for (const tab of await tabs.all()) {
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        const panel = page.locator('.tour-panel:not([hidden])');
        await expect(panel).toHaveCount(1);
        await expect(panel).toHaveAttribute('aria-labelledby', (await tab.getAttribute('id'))!);
        await expect(panel.locator('img')).toHaveCount(1);
        for (const screenshot of await panel.locator('img:visible').all()) {
          await screenshot.scrollIntoViewIfNeeded();
          await expect.poll(() => screenshot.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
        }
        const heading = await panel.locator('h3').boundingBox();
        const screenshot = await panel.locator('img').boundingBox();
        expect(heading!.y + heading!.height).toBeLessThan(screenshot!.y);
        expect(screenshot!.width).toBeGreaterThan((await panel.boundingBox())!.width - 4);
        await expect(panel.getByRole('link', { name: 'Open full-size screenshot', exact: true })).toHaveAttribute('target', '_blank');
        if (process.env.ROOST_SCREENSHOT_DIR && (await tab.getAttribute('id')) === 'tour-tab-calendar') {
          await panel.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, `features-events-${width}.png`) });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await tabs.last().focus();
      await page.keyboard.press('Home');
      await expect(tabs.first()).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(tabs.last()).toBeFocused();
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(tabs.first()).toBeFocused();
    }
  }
});

test('documentation search finds and opens the recovery guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Search documentation/ }).click();
  await page.getByRole('searchbox', { name: 'Search documentation', exact: true }).fill('backups');
  const result = page.getByRole('dialog').locator('a[href="/docs/backups/"]');
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/docs\/backups\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Backups & recovery', exact: true })).toBeVisible();
});

test('controls wait for their handlers when the site script is delayed', async ({ page }) => {
  let releaseScript!: () => void;
  const scriptReady = new Promise<void>((resolve) => { releaseScript = resolve; });
  await page.route('**/_astro/*.js', async (route) => { await scriptReady; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  const search = page.getByRole('button', { name: /^Search documentation/ });
  await expect(search).toBeDisabled();
  releaseScript();
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByRole('searchbox', { name: 'Search documentation', exact: true })).toBeVisible();
});

test('mobile menus and code copying work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Documentation', exact: true }).click();
  await page.locator('main').getByRole('link', { name: 'Getting started', exact: true }).click();
  await page.getByRole('button', { name: 'Browse documentation' }).click();
  await page.getByRole('complementary', { name: 'Documentation navigation' }).getByRole('link', { name: 'Backups & recovery', exact: true }).click();
  const copy = page.locator('.copy-code').first();
  await copy.click();
  await expect(copy).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('AWS_BACKUP_BUCKET=your-private-backup-bucket');
});

test('code boxes wrap without internal scrolling and preserve copied commands', async ({ page, context }) => {
  test.setTimeout(240000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/docs/', ...guides.map(({ id }) => `/docs/${id}/`)]) {
      await page.goto(route);
      await expect(page.getByRole('button', { name: /^Search documentation/ })).toBeEnabled();
      const boxes = page.locator('.code-block');
      if (process.env.ROOST_SCREENSHOT_DIR && [390, 1440].includes(width) && route.startsWith('/docs/')) {
        if (await boxes.count()) await boxes.first().locator('button').scrollIntoViewIfNeeded();
        const guide = route.split('/').filter(Boolean).at(-1);
        await page.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, `${guide}-${width}.png`) });
      }
      if (await boxes.count() === 0) {
        await expect(page.locator('main pre')).toHaveCount(0);
        continue;
      }
      await expect(boxes.first()).toBeVisible();
      expect(await boxes.evaluateAll((elements) => elements.flatMap((box) => {
        const pre = box.querySelector('pre')!;
        const code = pre.querySelector('code')!;
        const button = box.querySelector('button')!;
        const inline = box.classList.contains('code-block-inline');
        const fits = pre.scrollWidth <= pre.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1
          && code.getBoundingClientRect().right <= pre.getBoundingClientRect().right + 1
          && (inline
            ? button.getBoundingClientRect().left >= pre.getBoundingClientRect().right
            : button.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top + 1);
        return fits ? [] : [{
          code: code.textContent?.slice(0, 120), inline,
          scrollWidth: pre.scrollWidth, width: pre.clientWidth,
          scrollHeight: pre.scrollHeight, height: pre.clientHeight,
          codeRight: code.getBoundingClientRect().right, preRight: pre.getBoundingClientRect().right,
          buttonLeft: button.getBoundingClientRect().left,
        }];
      })), `${route} code boxes at ${width}px`).toEqual([]);
      for (const box of await boxes.all()) {
        const original = await box.locator('code').textContent();
        await box.locator('button').click();
        await expect(box.locator('button')).toHaveText('Copied');
        // Windows' clipboard normalizes line endings to CRLF.
        expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(original?.replace(/\r\n/g, '\n'));
        if (route === '/docs/') expect(original).toBe('git clone https://github.com/msrbuilds/roost.git\ncd roost\nbash install.sh');
      }
    }
  }
});

test('the homepage install command stays compact with Copy beside it', async ({ page }) => {
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const box = page.locator('.install-strip .code-block-inline');
    await expect(box).toBeVisible();
    const bounds = await box.boundingBox();
    expect(bounds!.height).toBeLessThan(width >= 800 ? 70 : 150);
    await expect(box.locator('.code-toolbar')).toHaveCount(0);
    const pre = await box.locator('pre').boundingBox();
    const button = await box.getByRole('button', { name: 'Copy code to clipboard', exact: true }).boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(pre!.x + pre!.width);
  }
});

test('single-line docs commands stay compact and copy their complete contents', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const examples = [
    ['self-hosted-setup', "SELECT setup_first_admin('your-email@example.com');"],
    ['docker-vps', 'docker compose up -d --build'],
    ['dockploy-vps-troubleshooting', 'docker exec "$KONG" sh -lc "grep -n'],
    ['dockploy-vps-troubleshooting', 'docker restart ${APP_PREFIX}-rest-1'],
    ['dockploy-vps', 'psql -U postgres -d postgres -c'],
    ['install-script', 'bash install.sh'],
    ['netlify', 'netlify plugins:install netlify-plugin-lighthouse'],
    ['supabase-selfhosted', 'docker compose up -d'],
    ['supabase-selfhosted', 'docker compose restart'],
  ];
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [guide, command] of examples) {
      await page.goto(`/docs/${guide}/`);
      const box = page.locator('.docs-content .code-block-inline').filter({ hasText: command }).first();
      await expect(box).toBeVisible();
      await expect(box.locator('.code-toolbar')).toHaveCount(0);
      const code = await box.locator('code').textContent();
      expect(code?.trimEnd()).not.toMatch(/[\r\n]/);
      expect(await box.evaluate((element) => {
        const pre = element.querySelector('pre')!;
        const button = element.querySelector('button')!;
        return pre.scrollWidth <= pre.clientWidth + 1
          && pre.scrollHeight <= pre.clientHeight + 1
          && button.getBoundingClientRect().left >= pre.getBoundingClientRect().right
          && element.getBoundingClientRect().right <= document.documentElement.clientWidth + 1;
      }), `${guide} at ${width}px`).toBe(true);
      await box.locator('button').click();
      await expect(box.locator('button')).toHaveText('Copied');
      expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code?.replace(/\r\n/g, '\n'));
    }
    // The installer example has three actual commands and keeps its toolbar.
    await page.goto('/docs/self-hosted-setup/');
    const multiline = page.locator('.docs-content .code-block').filter({ hasText: 'git clone https://github.com/msrbuilds/roost.git' }).first();
    await expect(multiline).not.toHaveClass(/code-block-inline/);
    await expect(multiline.locator('.code-toolbar')).toBeVisible();
  }
});


test('illustrated member and admin guides load responsive full-size screenshots', async ({ page, request }) => {
  test.setTimeout(120000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const guide of ['using-roost', 'administration', 'self-hosted-setup', 'backups']) {
      await page.goto(`/docs/${guide}/`);
      const pictures = page.locator('.docs-content img');
      expect(await pictures.count()).toBeGreaterThan(0);
      for (const picture of await pictures.all()) {
        await picture.scrollIntoViewIfNeeded();
        await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        const link = picture.locator('..');
        await expect(link).toHaveClass('docs-screenshot');
        await expect(link).toHaveAttribute('target', '_blank');
        expect((await request.get((await link.getAttribute('href'))!)).ok()).toBe(true);
        expect(await picture.evaluate((image) => image.getBoundingClientRect().right <= innerWidth)).toBe(true);
      }
    }
  }
});


test('comparisons remain readable and preserve price qualifiers on desktop and mobile', async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/compare/']) {
      await page.goto(route);
      const comparison = page.locator('.comparison-section');
      await expect(comparison.getByText('$0 license fee', { exact: true })).toBeVisible();
      await expect(comparison.getByText('$9/mo Hobby · $99/mo Pro', { exact: true })).toBeVisible();
      await expect(comparison.getByText('$89/mo, billed annually', { exact: true })).toBeVisible();
      await expect(comparison).toContainText('You pay for hosting, storage, email');
      await expect(comparison.locator('table')).toHaveCount(route === '/' ? 1 : 2);
      expect(await comparison.locator('td').evaluateAll(cells => cells.every(cell => {
        const bounds = cell.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && cell.scrollWidth <= cell.clientWidth + 1;
      }))).toBe(true);
      for (const link of await comparison.locator('.comparison-sources a').all()) {
        expect(await link.getAttribute('href')).toMatch(/^https:\/\/(www\.skool\.com|help\.skool\.com|circle\.so)\//);
      }
      if (route === '/compare/') {
        await expect(comparison).toContainText('External video embed + live chat');
        await expect(comparison).toContainText('disabled by default');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (process.env.ROOST_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await comparison.screenshot({ path: join(process.env.ROOST_SCREENSHOT_DIR, `comparison-${route === '/' ? 'home' : 'full'}-${width}.png`) });
      }
    }
  }
});
