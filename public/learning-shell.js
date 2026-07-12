(() => {
const learningNavItems = [
  { key: "center", href: "./index.html", label: "学习中心", icon: "book-open.svg" },
  { key: "scope", href: "./scope.html", label: "练习范围", icon: "list-checks.svg" },
  { key: "route", href: "./learning-route.html", label: "个性化学习路线", icon: "route.svg" },
  { key: "wrong", href: "./wrong-review.html", label: "错题复盘", icon: "clipboard-pen-line.svg" },
  { key: "self-test", href: "./self-test.html", label: "阶段自测", icon: "square-function.svg" },
  { key: "review", href: "./learning-review.html", label: "学习复盘", icon: "chart-pie.svg", separated: true }
];

const learnerIdStorageKey = "digital-circuit-learner-id";

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
  return data;
}

function renderLearningNavigation() {
  const container = document.querySelector("[data-learning-nav]");
  if (!container) return;
  const activePage = document.body.dataset.learningPage || "center";
  container.innerHTML = learningNavItems.map((item) => `
    <a class="platform-nav-link${item.key === activePage ? " active" : ""}${item.separated ? " separated" : ""}"
      href="${item.href}"${item.key === activePage ? ' aria-current="page"' : ""}>
      <img src="./assets/icons/${item.icon}" alt="" aria-hidden="true">
      <span>${item.label}</span>
    </a>
  `).join("");
}

function installPageTransitions() {
  const overlay = document.createElement("div");
  overlay.className = "platform-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = "<span></span><span></span><span></span>";
  document.body.append(overlay);
  requestAnimationFrame(() => document.body.classList.add("platform-page-ready"));

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target === "_blank" || link.hasAttribute("download")) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.href === location.href) return;
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
}

window.learningPlatform = {
  fetchJson: platformFetchJson,
  learnerId: platformUserId,
  navigation: learningNavItems
};

renderLearningNavigation();
installPageTransitions();
})();
