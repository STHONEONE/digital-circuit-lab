import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-site-nav-"));
process.env.DATA_DIR = dataDir;

const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const pages = [
  { file: "index.html", activeIndex: 0 },
  { file: "scope.html", activeIndex: 0 },
  { file: "learning-route.html", activeIndex: 0 },
  { file: "wrong-review.html", activeIndex: 0 },
  { file: "self-test.html", activeIndex: 0 },
  { file: "learning-review.html", activeIndex: 0 },
  { file: "gate-builder-demo.html", activeIndex: 1 },
  { file: "labs.html", activeIndex: 2 },
  { file: "extensions.html", activeIndex: 3 },
];

const expectedLinks = [
  { href: "./index.html", label: "学习中心" },
  { href: "./gate-builder-demo.html", label: "电路搭建" },
  { href: "./labs.html", label: "实验中心" },
  { href: "./extensions.html", label: "专题仿真" },
];

function attributesFrom(source) {
  const attributes = {};
  for (const match of source.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function hasClass(attributes, className) {
  return (attributes.class || "").split(/\s+/).includes(className);
}

function openingTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, "gi"))].map((match) => ({
    source: match[0],
    attributes: attributesFrom(match[1]),
  }));
}

function elementBlocks(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi"))].map(
    (match) => ({
      source: match[0],
      attributes: attributesFrom(match[1]),
      inner: match[2],
    }),
  );
}

function visibleText(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

test("all official pages expose the same four-destination platform navigation contract", async (t) => {
  for (const page of pages) {
    await t.test(page.file, async () => {
      const response = await fetch(`${baseUrl}/${page.file}`);
      assert.equal(response.status, 200);
      const html = await response.text();

      const platformHeaders = openingTags(html, "header").filter(({ attributes }) =>
        hasClass(attributes, "platform-topbar"),
      );
      assert.equal(platformHeaders.length, 1, "expected exactly one header.platform-topbar");
      assert.equal(
        hasClass(platformHeaders[0].attributes, page.file === "labs.html" ? "lab-topbar" : "topbar"),
        true,
        page.file === "labs.html"
          ? "labs header must retain lab-topbar"
          : "non-labs header must retain topbar",
      );

      const brands = elementBlocks(html, "a").filter(({ attributes }) => hasClass(attributes, "platform-brand"));
      assert.equal(brands.length, 1, "expected exactly one a.platform-brand");
      assert.equal(brands[0].attributes.href, "./home.html");
      assert.match(brands[0].inner, /circuit-board\.svg/);
      assert.match(visibleText(brands[0].inner), /数字电路实验中心/);

      const navs = elementBlocks(html, "nav").filter(({ attributes }) => hasClass(attributes, "site-nav"));
      assert.equal(navs.length, 1, "expected exactly one nav.site-nav");

      const links = elementBlocks(navs[0].inner, "a");
      assert.equal(links.length, expectedLinks.length, "site navigation must contain exactly four links");
      assert.deepEqual(
        links.map(({ attributes, inner }) => ({ href: attributes.href, label: visibleText(inner) })),
        expectedLinks,
        "site navigation destinations and order must stay consistent",
      );

      const activeIndexes = links.flatMap(({ attributes }, index) =>
        hasClass(attributes, "active") ? [index] : [],
      );
      const currentIndexes = links.flatMap(({ attributes }, index) =>
        attributes["aria-current"] === "page" ? [index] : [],
      );
      assert.deepEqual(activeIndexes, [page.activeIndex], "exactly one destination must have the active class");
      assert.deepEqual(
        currentIndexes,
        activeIndexes,
        "the active destination must be the same element carrying aria-current=page",
      );
    });
  }
});

test("shared navigation stylesheet defines the desktop, active and mobile layout contracts", async () => {
  const response = await fetch(`${baseUrl}/site-nav.css`);
  assert.equal(response.status, 200);
  const css = await response.text();

  assert.match(css, /\.platform-topbar\b/);
  assert.match(css, /\.platform-brand\b/);
  assert.match(css, /grid-template-columns\s*:/);
  assert.match(css, /position\s*:\s*sticky\s*;/);
  const usesUnderlinePseudoElement =
    /\.site-nav__link(?:\.active|\[aria-current=["']page["']\])::after/.test(css);
  const activeRule = [...css.matchAll(/([^{}]*(?:\.site-nav__link\.active|\.site-nav__link\[aria-current=["']page["']\])[^{}]*)\{([^}]*)\}/g)]
    .find(([, selector]) => !selector.includes("::after"));
  const usesUnderlineDeclaration = activeRule
    ? /(?:border-bottom\s*:|box-shadow\s*:\s*inset\s+0\s+-)/.test(activeRule[2])
    : false;
  assert.equal(
    usesUnderlinePseudoElement || usesUnderlineDeclaration,
    true,
    "the active destination must be distinguished with a bottom underline",
  );
  assert.match(css, /@media\s*\([^)]*max-width\s*:[^)]+\)/);
});
