import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-site-nav-ui-"));
process.env.DATA_DIR = dataDir;

const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);
const browserExecutable = browserCandidates.find((candidate) => fs.existsSync(candidate));

const primaryPages = [
  ["index.html", "./index.html"],
  ["gate-builder-demo.html", "./gate-builder-demo.html"],
  ["labs.html", "./labs.html"],
  ["extensions.html", "./extensions.html"]
];

let browser;

test.before(async () => {
  if (browserExecutable) {
    browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  }
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("desktop primary pages render one identical 60px platform header", {
  skip: browserExecutable ? false : "未找到可用于统一导航验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const [pathname, activeHref] of primaryPages) {
    await page.goto(`${baseUrl}/${pathname}`, { waitUntil: "networkidle" });
    const metrics = await page.locator(".platform-topbar").evaluate((header) => {
      const rect = header.getBoundingClientRect();
      const style = getComputedStyle(header);
      const active = header.querySelector('.site-nav__link[aria-current="page"]');
      const activeStyle = active ? getComputedStyle(active) : null;
      return {
        top: rect.top,
        width: rect.width,
        height: rect.height,
        position: style.position,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        activeHref: active?.getAttribute("href"),
        activeColor: activeStyle?.color,
        linkHeights: [...header.querySelectorAll(".site-nav__link")]
          .map((link) => link.getBoundingClientRect().height),
        brandVisible: header.querySelector(".platform-brand")?.getBoundingClientRect().width > 0
      };
    });

    assert.ok(Math.abs(metrics.top) <= 1, `${pathname} header should start at the viewport top`);
    assert.ok(Math.abs(metrics.width - 1440) <= 1, `${pathname} header should span the viewport`);
    assert.ok(Math.abs(metrics.height - 60) <= 1, `${pathname} header should be 60px tall`);
    assert.equal(metrics.position, "sticky");
    assert.equal(metrics.borderRadius, "0px");
    assert.match(metrics.backgroundColor, /^rgba?\(3, 15, 33/);
    assert.equal(metrics.activeHref, activeHref);
    assert.equal(metrics.activeColor, "rgb(57, 223, 244)");
    assert.equal(metrics.brandVisible, true);
    assert.equal(metrics.linkHeights.length, 4);
    assert.ok(metrics.linkHeights.every((height) => height >= 58));
  }

  assert.deepEqual(pageErrors, []);
  await context.close();
});

test("390px navigation stays inside the viewport and routes with the correct active state", {
  skip: browserExecutable ? false : "未找到可用于统一导航响应式验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const [pathname, activeHref] of primaryPages) {
    await page.goto(`${baseUrl}/${pathname}`, { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => {
      const header = document.querySelector(".platform-topbar");
      const nav = header?.querySelector(".site-nav");
      const active = header?.querySelector('.site-nav__link[aria-current="page"]');
      const headerRect = header?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const activeRect = active?.getBoundingClientRect();
      const mainRect = document.querySelector("main")?.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerLeft: headerRect?.left,
        headerRight: headerRect?.right,
        headerHeight: headerRect?.height,
        navLeft: navRect?.left,
        navRight: navRect?.right,
        activeLeft: activeRect?.left,
        activeRight: activeRect?.right,
        activeHref: active?.getAttribute("href"),
        linkHeights: [...(nav?.querySelectorAll(".site-nav__link") || [])]
          .map((link) => link.getBoundingClientRect().height),
        mainTop: mainRect?.top,
        headerBottom: headerRect?.bottom
      };
    });

    assert.ok(metrics.scrollWidth <= metrics.pageWidth + 1, `${pathname} should not create page-level horizontal overflow`);
    assert.ok((metrics.headerLeft ?? -2) >= -1 && (metrics.headerRight ?? 392) <= 391);
    assert.ok(Math.abs((metrics.headerHeight ?? 0) - 60) <= 1);
    assert.equal(metrics.activeHref, activeHref);
    assert.ok(metrics.linkHeights.every((height) => height >= 44));
    assert.ok((metrics.activeLeft ?? -2) >= (metrics.navLeft ?? 0) - 1);
    assert.ok((metrics.activeRight ?? 392) <= (metrics.navRight ?? 390) + 1);
    assert.ok((metrics.mainTop ?? 0) >= (metrics.headerBottom ?? 0) - 1, `${pathname} main content should not be covered by the header`);
  }

  await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
  for (const [pathname, activeHref] of primaryPages.slice(1)) {
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith(`/${pathname}`)),
      page.locator(`.site-nav__link[href="${activeHref}"]`).click()
    ]);
    assert.equal(await page.locator('.site-nav__link[aria-current="page"]').getAttribute("href"), activeHref);
  }

  assert.deepEqual(pageErrors, []);
  await context.close();
});

test("page navigation has no transition overlay or delayed click interception", {
  skip: browserExecutable ? false : "未找到可用于无动画导航验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  async function assertNoTransitionArtifacts() {
    const state = await page.evaluate(() => {
      const forbiddenClasses = [
        "page-enter", "page-enter-active", "page-leave",
        "platform-page-ready", "platform-page-leaving"
      ];
      return {
        overlayCount: document.querySelectorAll(".transition-flash, .platform-transition").length,
        bodyClasses: forbiddenClasses.filter((className) => document.body.classList.contains(className))
      };
    });
    assert.equal(state.overlayCount, 0, "transition overlays must not be mounted");
    assert.deepEqual(state.bodyClasses, [], "transition state classes must not be applied");
  }

  async function assertNativeNavigation(source, selector, destination) {
    await page.goto(`${baseUrl}/${source}`, { waitUntil: "networkidle" });
    await assertNoTransitionArtifacts();
    await page.evaluate(() => {
      sessionStorage.removeItem("navigation-default-prevented");
      document.addEventListener("click", (event) => {
        if (event.target.closest("a[href]")) {
          sessionStorage.setItem("navigation-default-prevented", String(event.defaultPrevented));
        }
      }, { once: true });
    });
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith(`/${destination}`)),
      page.locator(selector).click()
    ]);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("navigation-default-prevented")), "false",
      `${source} should allow the browser to navigate directly`);
    await assertNoTransitionArtifacts();
  }

  await assertNativeNavigation("home.html", ".enter-button", "index.html");
  await assertNativeNavigation("index.html", '.site-nav__link[href="./gate-builder-demo.html"]', "gate-builder-demo.html");
  await assertNativeNavigation("extensions.html", '.site-nav__link[href="./index.html"]', "index.html");

  await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    sessionStorage.removeItem("navigation-default-prevented");
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-learning-nav] a[href]")) {
        sessionStorage.setItem("navigation-default-prevented", String(event.defaultPrevented));
      }
    }, { once: true });
  });
  await Promise.all([
    page.waitForURL((url) => url.pathname.endsWith("/learning-route.html")),
    page.locator('[data-learning-nav] a[href="./learning-route.html"]').click()
  ]);
  await page.waitForFunction(() => document.body.dataset.learningPage === "route");
  await page.locator('iframe[data-learning-view="route"]').waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => sessionStorage.getItem("navigation-default-prevented")), "true",
    "same-shell learning navigation should keep its intentional interception");
  await assertNoTransitionArtifacts();

  await page.goBack();
  await page.waitForFunction(() => document.body.dataset.learningPage === "center");
  assert.match(page.url(), /\/index\.html$/);
  await assertNoTransitionArtifacts();

  await page.goForward();
  await page.waitForFunction(() => document.body.dataset.learningPage === "route");
  await page.locator('iframe[data-learning-view="route"]').waitFor({ state: "visible" });
  await assertNoTransitionArtifacts();

  assert.deepEqual(pageErrors, []);
  await context.close();
});

test("tablet-width brand and navigation never overlap", {
  skip: browserExecutable ? false : "未找到可用于统一导航中间断点验证的 Chromium 浏览器"
}, async () => {
  for (const width of [768, 820, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
    const metrics = await page.locator(".platform-topbar").evaluate((header) => {
      const brand = header.querySelector(".platform-brand")?.getBoundingClientRect();
      const nav = header.querySelector(".site-nav")?.getBoundingClientRect();
      return {
        brandRight: brand?.right,
        navLeft: nav?.left,
        scrollWidth: document.documentElement.scrollWidth,
        pageWidth: document.documentElement.clientWidth
      };
    });
    assert.ok((metrics.brandRight ?? 0) <= (metrics.navLeft ?? 0) - 8, `${width}px brand should not overlap navigation`);
    assert.ok(metrics.scrollWidth <= metrics.pageWidth + 1, `${width}px should not create page overflow`);
    await context.close();
  }
});
