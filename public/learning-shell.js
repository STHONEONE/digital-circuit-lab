(() => {
const learningNavItems = [
  { key: "center", href: "./index.html", label: "普通练习", icon: "book-open.svg", title: "数字电路智能练习系统" },
  { key: "route", href: "./learning-route.html", label: "知识复习", icon: "route.svg", title: "知识复习 · 数字电路学习平台" },
  { key: "wrong", href: "./wrong-review.html", label: "错题复盘", icon: "clipboard-pen-line.svg", title: "错题复盘 · 数字电路学习平台" },
  { key: "self-test", href: "./self-test.html", label: "个性化学习", icon: "square-function.svg", title: "个性化学习 · 数字电路学习平台" },
  { key: "review", href: "./learning-review.html", label: "学习报告", icon: "chart-pie.svg", title: "学习报告 · 数字电路学习平台" }
];

const embeddedView = window.parent !== window
  && new URLSearchParams(window.location.search).get("learning-embedded") === "1";
if (embeddedView) document.documentElement.classList.add("learning-embedded");

const learnerIdStorageKey = "digital-circuit-learner-id";
const learningDataVersionKey = "digital-circuit-learning-data-version";

function platformLearnerId() {
  try {
    const existing = localStorage.getItem(learnerIdStorageKey);
    if (/^[a-zA-Z0-9_-]{1,100}$/.test(existing || "")) return existing;
    const created = globalThis.crypto?.randomUUID?.()
      || `learner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(learnerIdStorageKey, created);
    return created;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const platformUserId = platformLearnerId();

async function platformFetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Learner-Id", platformUserId);
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  if (url === "/api/answers" && String(options.method || "GET").toUpperCase() === "POST") {
    try {
      localStorage.setItem(learningDataVersionKey, JSON.stringify({ learnerId: platformUserId, updatedAt: Date.now() }));
    } catch {
      // The report still refreshes when it becomes visible if storage is unavailable.
    }
  }
  return data;
}

function renderLearningNavigation(activePage = document.body.dataset.learningPage || "center") {
  const container = document.querySelector("[data-learning-nav]");
  if (!container) return;
  container.innerHTML = learningNavItems.map((item) => `
    <a class="platform-nav-link${item.key === activePage ? " active" : ""}${item.separated ? " separated" : ""}"
      href="${item.href}"${item.key === activePage ? ' aria-current="page"' : ""}>
      <img src="./assets/icons/${item.icon}" alt="" aria-hidden="true">
      <span>${item.label}</span>
    </a>
  `).join("");
}

function learningItemForUrl(url) {
  const path = new URL(url, location.href).pathname.toLowerCase();
  return learningNavItems.find((item) => new URL(item.href, location.href).pathname.toLowerCase() === path) || null;
}

function setActiveNavigation(page) {
  document.querySelectorAll("[data-learning-nav] .platform-nav-link").forEach((link) => {
    const active = learningItemForUrl(link.href)?.key === page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function installPageTransitions() {
  if (embeddedView) {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const item = learningItemForUrl(link.href);
      if (!item || typeof window.parent.learningPlatform?.switchPage !== "function") return;
      event.preventDefault();
      const destination = new URL(link.href, location.href);
      if (destination.search) {
        window.parent.location.assign(destination.href);
        return;
      }
      window.parent.learningPlatform.switchPage(item.key);
    });
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "platform-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = "<span></span><span></span><span></span>";
  document.body.append(overlay);
  requestAnimationFrame(() => document.body.classList.add("platform-page-ready"));

  const main = document.querySelector("main");
  const navigation = document.querySelector("[data-learning-nav]");
  const initialPage = document.body.dataset.learningPage || "center";
  const initialNodes = main ? [...main.children].filter((node) => node !== navigation) : [];
  const centerExtras = initialPage === "center" ? [...document.querySelectorAll([
    "#systemNotice", "#aiChatLauncher", "#aiVariantLauncher", "#aiVariantFloat", "#aiChatPanel"
  ].join(","))] : [];
  const views = new Map([[initialPage, { nodes: initialNodes, extras: centerExtras, frame: null }]]);
  let activePage = initialPage;
  let visiblePage = initialPage;
  let switchSequence = 0;

  function hideView(page) {
    const view = views.get(page);
    if (!view) return;
    if (view.frame) {
      view.frame.hidden = true;
      return;
    }
    view.nodes.forEach((node) => node.remove());
    view.extras.forEach((node) => node.remove());
  }

  function showView(page) {
    const view = views.get(page);
    if (!view || !main) return;
    if (view.frame) {
      view.frame.hidden = false;
      view.frame.contentWindow?.focus({ preventScroll: true });
      return;
    }
    view.nodes.forEach((node) => main.append(node));
    view.extras.forEach((node) => document.body.append(node));
  }

  function createView(item) {
    if (!main) return Promise.reject(new Error("学习内容容器不存在"));
    const frame = document.createElement("iframe");
    const source = new URL(item.href, location.href);
    source.searchParams.set("learning-embedded", "1");
    frame.className = "learning-view-frame";
    frame.title = `${item.label}内容`;
    frame.hidden = true;
    frame.setAttribute("loading", "eager");
    frame.setAttribute("data-learning-view", item.key);
    views.set(item.key, { nodes: [], extras: [], frame });
    main.append(frame);
    return new Promise((resolve, reject) => {
      frame.addEventListener("load", () => resolve(frame), { once: true });
      frame.addEventListener("error", () => reject(new Error(`${item.label}加载失败`)), { once: true });
      frame.src = source.href;
    });
  }

  async function switchLearningPage(page, { history = true } = {}) {
    const item = learningNavItems.find((entry) => entry.key === page);
    if (!item || page === activePage) return;
    const previousPage = activePage;
    const sequence = ++switchSequence;
    activePage = page;
    document.body.dataset.learningPage = page;
    setActiveNavigation(page);
    document.title = item.title;
    if (history) historyApi(item.href, page);
    main?.setAttribute("aria-busy", "true");
    try {
      if (!views.has(page)) await createView(item);
      if (sequence !== switchSequence || activePage !== page) return;
      hideView(visiblePage);
      showView(page);
      visiblePage = page;
    } catch (error) {
      if (sequence !== switchSequence) return;
      activePage = previousPage;
      document.body.dataset.learningPage = previousPage;
      setActiveNavigation(previousPage);
      throw error;
    } finally {
      main?.removeAttribute("aria-busy");
    }
  }

  function historyApi(href, page) {
    const destination = new URL(href, location.href);
    if (destination.pathname === location.pathname) return;
    window.history.pushState({ learningPage: page }, "", destination.href);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target === "_blank" || link.hasAttribute("download")) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.href === location.href) return;
    const learningItem = learningItemForUrl(destination);
    if (learningItem && !destination.search) {
      event.preventDefault();
      switchLearningPage(learningItem.key).catch(() => location.assign(destination.href));
      return;
    }
    event.preventDefault();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      location.assign(destination.href);
      return;
    }
    document.body.classList.add("platform-page-leaving");
    window.setTimeout(() => location.assign(destination.href), 320);
  });

  window.addEventListener("pageshow", () => {
    document.body.classList.remove("platform-page-leaving");
    document.body.classList.add("platform-page-ready");
  });
  window.addEventListener("popstate", () => {
    const item = learningItemForUrl(location.href);
    if (item) switchLearningPage(item.key, { history: false }).catch(() => location.reload());
  });

  return switchLearningPage;
}

window.learningPlatform = {
  fetchJson: platformFetchJson,
  learnerId: platformUserId,
  navigation: learningNavItems
};

renderLearningNavigation();
window.learningPlatform.switchPage = installPageTransitions();
})();
