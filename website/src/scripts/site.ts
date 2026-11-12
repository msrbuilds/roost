const menuButton = document.querySelector<HTMLButtonElement>(".menu-trigger");
const mobileNavigation =
  document.querySelector<HTMLElement>("#mobile-navigation");
function closeMobileNavigation() {
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Open navigation");
  if (mobileNavigation) mobileNavigation.hidden = true;
}
const mobileViewport = window.matchMedia("(max-width: 800px)");
mobileViewport.addEventListener("change", ({ matches }) => {
  if (!matches) closeMobileNavigation();
});
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
  ".docs-content pre, .install-command, .docs-start-code pre",
)) {
  const code = pre.querySelector("code");
  if (!code) continue;
  const block = document.createElement("div");
  block.className = "code-block";
  // Classify the source lines, so a long command stays compact when it wraps
  // visually on a narrow screen. Ignore a fence's trailing line ending.
  const inline = !/[\r\n]/.test((code.textContent || "").trimEnd());
  if (inline) {
    block.classList.add("code-block-inline");
    // Keep syntax-highlighted snippets and their surrounding row one color.
    block.style.backgroundColor = pre.style.backgroundColor;
  }
  const toolbar = document.createElement("div");
  toolbar.className = "code-toolbar";
  const label = document.createElement("span");
  label.textContent = pre.dataset.language || "Code";
  toolbar.append(label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-code";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code to clipboard");
  button.setAttribute("aria-live", "polite");
  let resetLabel: number;
  button.addEventListener("click", async () => {
    window.clearTimeout(resetLabel);
    try {
      await navigator.clipboard.writeText(
        code.textContent || "",
      );
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Copied code to clipboard");
    } catch {
      // Clipboard access can be denied by the browser. Select the real code so
      // the user can still copy it using their keyboard or selection menu.
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      button.textContent = "Code selected";
      button.setAttribute("aria-label", "Code selected; copy using your keyboard or selection menu");
    }
    resetLabel = window.setTimeout(() => {
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code to clipboard");
    }, 2500);
  });
  pre.before(block);
  if (inline) {
    block.append(pre, button);
  } else {
    toolbar.append(button);
    block.append(toolbar, pre);
  }
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
const searchShortcut = document.querySelector<HTMLElement>("[data-search-shortcut]");
if (searchShortcut && /Mac|iPhone|iPad/.test(navigator.userAgent)) {
  searchShortcut.textContent = "⌘ K";
  searchShortcut.closest("button")?.setAttribute("aria-label", "Search documentation ⌘ K");
}
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
  if (event.key === "Escape" && !dialog?.open) {
    if (menuButton?.getAttribute("aria-expanded") === "true") {
      closeMobileNavigation();
      menuButton.focus();
    } else if (mobileViewport.matches && docsMenu?.getAttribute("aria-expanded") === "true") {
      docsMenu.setAttribute("aria-expanded", "false");
      document.querySelector("#docs-sidebar")?.classList.remove("is-open");
      docsMenu.focus();
    }
  }
  if (event.key === "Escape" && dialog?.open) {
    // A focused search input otherwise consumes the first Escape to clear its
    // value, leaving the modal open. Escape should always dismiss this dialog.
    event.preventDefault();
    dialog.close();
    return;
  }
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
