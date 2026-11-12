import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const expected = JSON.parse(await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'));
const origin = process.env.WEBSITE_BASE_URL || 'https://roost.msrbuilds.com';
let verified = false;
for (let attempt = 0; attempt < 24; attempt++) {
  try {
    const response = await fetch(new URL(`/build-info.json?commit=${expected.commit}&attempt=${attempt}`, origin), { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const actual = await response.json();
    if (response.ok && actual.commit === expected.commit && actual.guidesSha256 === expected.guidesSha256) {
      console.log(`Verified published website and guides at ${origin}: ${actual.commit}`);
      verified = true;
      break;
    }
  } catch { /* Allow Cloudflare's deployment to propagate before failing CI. */ }
  await setTimeout(5000);
}
if (!verified) throw new Error(`Production did not publish the expected website and guides commit ${expected.commit}`);
