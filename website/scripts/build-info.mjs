import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// A public commit stamp lets CI distinguish a successful upload from a stale
// production deployment. Hash the actual guide inputs, including their names.
const guides = new URL('../../guides/', import.meta.url);
const hash = createHash('sha256');
for (const name of (await readdir(guides)).filter((name) => name.endsWith('.md')).sort()) {
  hash.update(name).update('\0').update(await readFile(new URL(name, guides))).update('\0');
}
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile(new URL('../dist/build-info.json', import.meta.url), JSON.stringify({ commit, guidesSha256: hash.digest('hex') }) + '\n');
