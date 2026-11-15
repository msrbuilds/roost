import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

// Mutable public URLs need a new cache key when their content changes.
const publicAssetVersions = Object.fromEntries(
  ["technology", "alternatives"].flatMap((directory) =>
    readdirSync(new URL(`./public/${directory}/`, import.meta.url))
      .filter((name) => /\.(svg|png)$/.test(name))
      .map((name) => [
        `/${directory}/${name}`,
        createHash("sha256")
          .update(readFileSync(new URL(`./public/${directory}/${name}`, import.meta.url)))
          .digest("hex").slice(0, 12),
      ]),
  ),
);

// The docs read the repository guides directly: one maintained source.
function documentationLinks() {
  return (tree) => {
    // The page layout supplies the single visible H1; retain the guide title
    // in Markdown for GitHub without rendering a duplicate heading here.
    if (tree.children[0]?.type === "heading" && tree.children[0].depth === 1) {
      tree.children.shift();
    }
    function walk(node) {
      if (
        node.type === "link" &&
        typeof node.url === "string" &&
        !/^(https?:|mailto:|#)/.test(node.url)
      ) {
        const match = node.url.match(
          /^(?:\.\/|\.\.\/guides\/)?([^/]+)\.md(#[^]*)?$/,
        );
        if (match) node.url = `/docs/${match[1]}/${match[2] || ""}`;
      }
      for (const child of node.children || []) walk(child);
    }
    walk(tree);
  };
}

function keyboardTables() {
  return (tree) => {
    function walk(node) {
      // Add this to the rendered HTML tree, including tables produced by GFM.
      if (node.type === 'element' && node.tagName === 'table') {
        node.properties ||= {};
        node.properties.tabIndex = 0;
      }
      for (const child of node.children || []) walk(child);
    }
    walk(tree);
  };
}

export default defineConfig({
  site: "https://roost.msrbuilds.com",
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
  // The deployed CSP allows same-origin scripts without inline execution.
  vite: { define: { __ROOST_PUBLIC_ASSETS__: JSON.stringify(publicAssetVersions) }, build: { assetsInlineLimit: 0 } },
  markdown: {
    processor: unified({ remarkPlugins: [documentationLinks], rehypePlugins: [keyboardTables] }),
    // The older github-dark theme renders comments below AA contrast.
    shikiConfig: { theme: "github-dark-default", langAlias: { env: "dotenv" } },
  },
});
