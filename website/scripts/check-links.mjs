import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

const root = resolve("dist");
async function pages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? pages(join(directory, entry.name))
          : entry.name.endsWith(".html")
            ? [join(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
}
const files = await pages(root);
const errors = [];
let count = 0;
for (const file of files) {
  const html = await readFile(file, "utf8");
  for (const [, attributes, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(attributes) && body.trim() && !/type="application\/(?:ld\+)?json"/.test(attributes)) {
      errors.push(`Inline executable script conflicts with production CSP: ${file}`);
    }
  }
  for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(raw)) continue;
    const path = decodeURIComponent(raw.split(/[?#]/)[0]);
    if (!path) continue;
    let target = path.startsWith("/")
      ? resolve(root, `.${path}`)
      : resolve(dirname(file), path);
    try {
      if ((await stat(target)).isDirectory())
        target = join(target, "index.html");
      await stat(target);
      count++;
    } catch {
      errors.push(`${file.slice(root.length)} → ${raw}`);
    }
  }
  if (!/<title>[^<]+<\/title>/.test(html))
    errors.push(`Missing title: ${file}`);
  if (!/name="description"/.test(html))
    errors.push(`Missing description: ${file}`);
  if (!/rel="canonical"/.test(html)) errors.push(`Missing canonical: ${file}`);
}
if (errors.length)
  throw new Error(`Website validation failed:\n${errors.join("\n")}`);
console.log(
  `PASS: ${files.length} pages, ${count} local links/assets, titles, descriptions, and canonical URLs.`,
);
