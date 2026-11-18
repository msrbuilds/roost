import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { createHash } from 'node:crypto';

const expected = JSON.parse(await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'));
const origin = process.env.WEBSITE_BASE_URL || 'https://roost.msrbuilds.com';
const digest = (content) => createHash('sha256').update(content).digest('hex');
function criticalAssets(html) {
  return [...html.matchAll(/<(?:link|script)\b[^>]*>/g)].flatMap(([tag]) => {
    if (tag.startsWith('<link') && !/\brel="stylesheet"/.test(tag)) return [];
    const asset = tag.match(/\b(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/);
    return asset && asset[1].startsWith('/_astro/') ? [asset[1]] : [];
  }).sort();
}
const pages = await Promise.all(['/', '/features/', '/docs/'].map(async (route) => {
  const html = await readFile(new URL(`../dist/${route === '/' ? '' : route.slice(1)}index.html`, import.meta.url), 'utf8');
  const assets = criticalAssets(html);
  if (!assets.some(asset => asset.endsWith('.css'))) throw new Error(`No stylesheet found in built ${route}`);
  return { route, assets };
}));
const assets = await Promise.all([...new Set(pages.flatMap(page => page.assets))].map(async (path) => ({
  path, hash: digest(await readFile(new URL(`../dist${path}`, import.meta.url))),
})));
async function responseFor(path, signal) {
  const response = await fetch(new URL(path, origin), { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response;
}
let verified = false;
let ready = 0;
for (let attempt = 0; attempt < 24; attempt++) {
  try {
    const signal = AbortSignal.timeout(15000);
    const response = await responseFor(`/build-info.json?commit=${expected.commit}&attempt=${attempt}`, signal);
    const actual = await response.json();
    if (actual.commit !== expected.commit || actual.guidesSha256 !== expected.guidesSha256) throw new Error('Published commit or guides are still stale');
    await Promise.all(pages.map(async ({ route, assets }) => {
      const response = await responseFor(route, signal);
      if (!response.headers.get('content-type')?.includes('text/html')) throw new Error(`${route} did not return HTML`);
      if (JSON.stringify(criticalAssets(await response.text())) !== JSON.stringify(assets)) throw new Error(`${route} still references different CSS/JavaScript`);
    }));
    await Promise.all(assets.map(async ({ path, hash }) => {
      const response = await responseFor(path, signal);
      const type = response.headers.get('content-type') || '';
      if (!(path.endsWith('.css') ? type.includes('text/css') : /javascript|ecmascript/.test(type))) throw new Error(`${path} has the wrong content type: ${type}`);
      if (digest(Buffer.from(await response.arrayBuffer())) !== hash) throw new Error(`${path} differs from the built asset`);
    }));
    // A commit stamp can arrive before its new asset URLs are ready at the edge.
    if (++ready === 2) {
      console.log(`Verified published website, guides, and ${assets.length} CSS/JavaScript assets at ${origin}: ${actual.commit}`);
      verified = true;
      break;
    }
  } catch (error) {
    ready = 0;
    console.log(`Deployment not ready (${attempt + 1}/24): ${error.message}`);
  }
  await setTimeout(5000);
}
if (!verified) throw new Error(`Production did not publish the expected website, guides, and assets for ${expected.commit}`);
