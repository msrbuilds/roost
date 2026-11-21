// Carousels stop on interaction; visitors can explicitly restart rotation.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
for (const video of document.querySelectorAll<HTMLElement>('[data-intro-video]')) {
  const play = video.querySelector<HTMLButtonElement>('[data-video-play]')!;
  const stage = video.querySelector<HTMLElement>('[data-video-stage]')!;
  const status = video.querySelector<HTMLElement>('[data-video-status]')!;
  play.addEventListener('click', () => {
    // No YouTube resources are requested until the visitor chooses to play.
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/XVmHSLuBeNU?autoplay=1&rel=0&playsinline=1';
    frame.title = 'Roost introduction video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    status.textContent = 'Video player opened. Use the player controls, or watch on YouTube using the link below.';
    stage.replaceChildren(frame);
    frame.focus();
  }, { once: true });
  play.disabled = false;
}
for (const hero of document.querySelectorAll<HTMLElement>('.hero-technologies')) {
  let inView = false;
  const sync = () => hero.toggleAttribute('data-motion-paused', !inView || document.hidden);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
  observer.observe(hero);
  document.addEventListener('visibilitychange', sync);
  sync();
}
for (const stack of document.querySelectorAll<HTMLElement>('[data-technology-stack]')) {
  const parts = [...stack.querySelectorAll<HTMLElement>('.tech-reveal')];
  if (reducedMotion.matches) {
    parts.forEach(part => part.setAttribute('data-revealed', ''));
  }
  const flow = stack.querySelector<HTMLElement>('.tech-flow');
  let flowInView = false;
  const sync = () => flow?.toggleAttribute('data-tech-active', flowInView && !document.hidden);
  document.addEventListener('visibilitychange', sync);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const part = entry.target as HTMLElement;
      if (part === flow) { flowInView = entry.isIntersecting; sync(); }
      if (entry.isIntersecting) {
        part.setAttribute('data-revealed', '');
        if (!part.classList.contains('tech-flow')) observer.unobserve(part);
      }
    }
  }, { threshold: .12 });
  parts.forEach(part => { part.setAttribute('data-motion-ready', ''); observer.observe(part); });
}
for (const marquee of document.querySelectorAll<HTMLElement>('[data-logo-marquee]')) {
  const pause = marquee.querySelector<HTMLButtonElement>('[data-marquee-pause]')!;
  let paused = reducedMotion.matches;
  const render = () => {
    marquee.toggleAttribute('data-paused', paused || document.hidden || reducedMotion.matches);
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Resume scrolling logos' : 'Pause scrolling logos');
    pause.disabled = reducedMotion.matches;
  };
  pause.addEventListener('click', () => { paused = !paused; render(); });
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; render(); });
  document.addEventListener('visibilitychange', render);
  marquee.setAttribute('data-enhanced', '');
  render();
}
for (const slider of document.querySelectorAll<HTMLElement>('[data-showcase-slider]')) {
  const tabs = [...slider.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = [...slider.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const play = slider.querySelector<HTMLButtonElement>('[data-slider-play]')!;
  const playLabel = play.querySelector<HTMLElement>('[data-slider-play-label]')!;
  const playIcon = play.querySelector<SVGPathElement>('[data-slider-play-icon]')!;
  const previous = slider.querySelector<HTMLButtonElement>('[data-slider-prev]')!;
  const next = slider.querySelector<HTMLButtonElement>('[data-slider-next]')!;
  const description = slider.querySelector<HTMLElement>('[data-slider-description]')!;
  const status = slider.querySelector<HTMLElement>('[data-slider-status]')!;
  let index = 0;
  let playing = !reducedMotion.matches;
  let inView = false;
  let hovered = false;
  let timer: number | undefined;
  let request = 0;
  const sync = () => {
    window.clearTimeout(timer);
    playLabel.textContent = playing ? 'Pause' : 'Play';
    playIcon.setAttribute('d', playing ? 'M8 5v14M16 5v14' : 'm8 5 11 7-11 7Z');
    play.setAttribute('aria-label', playing ? 'Pause screenshot slideshow' : 'Play screenshot slideshow');
    play.disabled = reducedMotion.matches;
    play.title = reducedMotion.matches ? 'Automatic rotation is off because reduced motion is enabled.' : '';
    if (playing && inView && !hovered && !document.hidden && !reducedMotion.matches) {
      timer = window.setTimeout(() => { void activate((index + 1) % tabs.length); }, 7000);
    }
  };
  const activate = async (target: number, manual = false, focus = false) => {
    const currentRequest = ++request;
    if (manual) { playing = false; sync(); }
    // Decode before swapping so slow connections keep a complete screenshot visible.
    const image = panels[target].querySelector<HTMLImageElement>('img')!;
    image.loading = 'eager';
    try { await image.decode(); } catch { sync(); return; }
    if (currentRequest !== request) return;
    // A decoded image may arrive after the visitor pauses or leaves the slider.
    if (!manual && (!playing || !inView || hovered || document.hidden || reducedMotion.matches)) {
      sync();
      return;
    }
    index = target;
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', String(position === index));
      tab.tabIndex = position === index ? 0 : -1;
      panels[position].hidden = position !== index;
    });
    description.textContent = tabs[index].dataset.description || '';
    if (manual) status.textContent = `${tabs[index].textContent}, screenshot ${index + 1} of ${tabs.length}`;
    if (focus) tabs[index].focus();
    sync();
  };
  tabs.forEach((tab, position) => {
    tab.addEventListener('click', () => { void activate(position, true); });
    tab.addEventListener('keydown', (event) => {
      const keys: Record<string, number> = { ArrowRight: (position + 1) % tabs.length, ArrowLeft: (position - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      void activate(keys[event.key], true, true);
    });
  });
  previous.addEventListener('click', () => { void activate((index - 1 + tabs.length) % tabs.length, true); });
  next.addEventListener('click', () => { void activate((index + 1) % tabs.length, true); });
  slider.addEventListener('focusin', (event) => { if (event.target !== play) { playing = false; sync(); } });
  play.addEventListener('click', () => { playing = !playing; sync(); });
  slider.addEventListener('mouseenter', () => { hovered = true; sync(); });
  slider.addEventListener('mouseleave', () => { hovered = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => { playing = false; sync(); });
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.25 });
  observer.observe(slider);
  slider.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
  sync();
}

const menuButton = document.querySelector<HTMLButtonElement>(".menu-trigger");

// Keep illustrated guides readable on small screens without duplicating assets.
for (const screenshot of document.querySelectorAll<HTMLImageElement>(".docs-content img")) {
  if (screenshot.closest('a')) continue;
  const link = document.createElement('a');
  link.href = screenshot.currentSrc || screenshot.src;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'docs-screenshot';
  link.setAttribute('aria-label', `Open full-size screenshot: ${screenshot.alt}`);
  screenshot.before(link);
  link.append(screenshot);
}

const screenshotPreviews = [...document.querySelectorAll<HTMLElement>('[data-screenshot-preview]')];
let appearanceRequest = 0;
for (const preview of screenshotPreviews) {
  for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-screenshot-mode]')) {
    button.disabled = false;
    button.addEventListener('click', async () => {
      const request = ++appearanceRequest;
      const mode = button.dataset.screenshotMode;
      const image = preview.querySelector<HTMLImageElement>(`[data-screenshot-variant="${mode}"] img`);
      if (!image) return;
      image.loading = 'eager';
      try { await image.decode(); } catch { return; }
      if (request !== appearanceRequest || preview.closest<HTMLElement>('.tour-panel')?.hidden) return;
      for (const item of screenshotPreviews) {
        if (!item.querySelector('[data-screenshot-mode]')) continue;
        for (const control of item.querySelectorAll('[data-screenshot-mode]')) control.setAttribute('aria-pressed', String(control.getAttribute('data-screenshot-mode') === mode));
        for (const figure of item.querySelectorAll<HTMLElement>('[data-screenshot-variant]')) figure.hidden = figure.dataset.screenshotVariant !== mode;
      }
    });
  }
}

for (const tour of document.querySelectorAll<HTMLElement>("[data-screenshot-tour]")) {
  const tabs = [...tour.querySelectorAll<HTMLButtonElement>(':scope > .tour-tabs > [role="tab"]')];
  const panels = [...tour.querySelectorAll<HTMLElement>(':scope > [role="tabpanel"]')];
  let request = 0;
  const activate = async (index: number, focus = false) => {
    const currentRequest = ++request;
    // A theme choice can change while a different feature's image is loading.
    // Decode the final appearance before exposing the next panel.
    let image = panels[index].querySelector<HTMLImageElement>('figure:not([hidden]) img');
    while (image) {
      image.loading = 'eager';
      try { await image.decode(); } catch { return; }
      if (currentRequest !== request) return;
      const selected = panels[index].querySelector<HTMLImageElement>('figure:not([hidden]) img');
      if (selected === image) break;
      image = selected;
    }
    if (currentRequest !== request) return;
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', String(position === index));
      tab.tabIndex = position === index ? 0 : -1;
      panels[position].hidden = position !== index;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { void activate(index); });
    tab.addEventListener('keydown', (event) => {
      const keys: Record<string, number> = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(event.key in keys)) return;
      event.preventDefault();
      void activate(keys[event.key], true);
    });
    tab.disabled = false;
  });
}
const mobileNavigation =
  document.querySelector<HTMLElement>("#mobile-navigation");
function closeMobileNavigation() {
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Open navigation");
  if (mobileNavigation) mobileNavigation.hidden = true;
}
const mobileViewport = window.matchMedia("(max-width: 800px)");
mobileViewport.addEventListener("change", ({ matches }) => {
  if (!matches) {
    closeMobileNavigation();
    closeDocumentationNavigation();
  }
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
function closeDocumentationNavigation() {
  docsMenu?.setAttribute("aria-expanded", "false");
  document.querySelector("#docs-sidebar")?.classList.remove("is-open");
}
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
      closeDocumentationNavigation();
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
