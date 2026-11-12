import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";

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

export default defineConfig({
  site: "https://roost.msrbuilds.com",
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
  // The deployed CSP allows same-origin scripts without inline execution.
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: {
    processor: unified({ remarkPlugins: [documentationLinks] }),
    // The older github-dark theme renders comments below AA contrast.
    shikiConfig: { theme: "github-dark-default", langAlias: { env: "dotenv" } },
  },
});
