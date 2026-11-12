const menuButton = document.querySelector<HTMLButtonElement>(".menu-trigger");
const mobileNavigation =
  document.querySelector<HTMLElement>("#mobile-navigation");
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  if (mobileNavigation) mobileNavigation.hidden = !open;
});

const docsMenu = document.querySelector<HTMLButtonElement>(".docs-menu-toggle");
if (menuButton) menuButton.disabled = false;
docsMenu?.addEventListener("click", () => {
  const open = docsMenu.getAttribute("aria-expanded") !== "true";
  docsMenu.setAttribute("aria-expanded", String(open));
  document.querySelector("#docs-sidebar")?.classList.toggle("is-open", open);
});

if (docsMenu) docsMenu.disabled = false;

for (const pre of document.querySelectorAll<HTMLElement>(
  ".docs-content pre, .install-command",
)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-code";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code to clipboard");
  button.setAttribute("aria-live", "polite");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        pre.querySelector("code")?.textContent || "",
      );
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select to copy";
    }
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1800);
  });
  pre.append(button);
}

interface SearchDocument {
  url: string;
  meta: { title?: string };
  excerpt: string;
}
interface SearchModule {
  search: (
    term: string,
  ) => Promise<{ results: { data: () => Promise<SearchDocument> }[] }>;
}
const dialog = document.querySelector<HTMLDialogElement>("#search-dialog");
const searchInput = document.querySelector<HTMLInputElement>("#docs-search");
const searchStatus = document.querySelector<HTMLElement>("#search-status");
const searchResults = document.querySelector<HTMLElement>("#search-results");
let pagefind: Promise<SearchModule> | undefined;
let searchGeneration = 0;
let debounce: number;
let previousFocus: HTMLElement | null = null;

function openSearch() {
  if (!dialog || dialog.open) return;
  previousFocus = document.activeElement as HTMLElement;
  dialog.showModal();
  searchInput?.focus();
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-search-open]")) {
  button.addEventListener("click", openSearch);
  button.disabled = false;
}
document
  .querySelector("[data-search-close]")
  ?.addEventListener("click", () => dialog?.close());
dialog?.addEventListener("close", () => previousFocus?.focus());
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});
searchInput?.addEventListener("input", () => {
  window.clearTimeout(debounce);
  const generation = ++searchGeneration;
  debounce = window.setTimeout(async () => {
    const term = searchInput.value.trim();
    if (!searchResults || !searchStatus) return;
    searchResults.replaceChildren();
    if (!term) {
      searchStatus.textContent = "Find your next step.";
      return;
    }
    searchStatus.textContent = "Searching…";
    try {
      const modulePath = "/pagefind/pagefind.js";
      pagefind ??= import(/* @vite-ignore */ modulePath);
      const search = await (await pagefind).search(term);
      const results = await Promise.all(
        search.results.slice(0, 8).map((result) => result.data()),
      );
      if (generation !== searchGeneration) return;
      searchStatus.textContent = results.length
        ? `${search.results.length} result${search.results.length === 1 ? "" : "s"}`
        : "No results. Try “Docker”, “email”, or “backups”.";
      for (const result of results) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = result.url;
        const title = document.createElement("strong");
        title.textContent = result.meta.title || "Documentation";
        const excerpt = document.createElement("span");
        excerpt.textContent = new DOMParser().parseFromString(
          result.excerpt,
          "text/html",
        ).body.textContent;
        link.append(title, excerpt);
        item.append(link);
        searchResults.append(item);
      }
    } catch {
      if (generation === searchGeneration)
        searchStatus.textContent =
          "Search is unavailable. Browse the documentation index instead.";
    }
  }, 180);
});
