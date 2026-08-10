/*
 * End-to-end test: loads the REAL unpacked extension into Chromium, drives the
 * genuine storage-toggle path via the service worker, and asserts every transform
 * and its restore. Also captures a store screenshot as a side effect.
 *
 * Run:  node --test tests/e2e.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const FIXTURE = readFileSync(join(here, "fixtures", "sample.html"), "utf8");

// A deliberately strict CSP page: img-src 'self' would block ANY external image.
// If our bundled image (chrome-extension:// origin) still paints, the core
// "works even on GitHub/banks" claim holds.
const CSP_PAGE = `<!DOCTYPE html><html><head><title>Strict CSP</title></head><body>
<h1>Locked down page</h1>
<img id="csphero" width="200" height="150"
  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23888'/%3E%3C/svg%3E" />
</body></html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url && req.url.startsWith("/csp")) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'self'; img-src 'self'; script-src 'self'",
        });
        res.end(CSP_PAGE);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(FIXTURE);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function getWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10000 });
  return sw;
}

async function setEnabled(sw, enabled, extra = {}) {
  await sw.evaluate(
    ([enabled, extra]) => new Promise((r) => chrome.storage.local.set({ enabled, ...extra }, r)),
    [enabled, extra]
  );
}

const SCAT_RE = /[a-z]{3,}/i;

test("SCATERNET transforms a page and restores it", async (t) => {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const userDataDir = mkdtempSync(join(tmpdir(), "scaternet-pw-"));

  const context = await chromium.launchPersistentContext(userDataDir, {
    // Playwright's default headless shell does NOT load extensions; the full
    // "chromium" channel (new headless) does.
    channel: "chromium",
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });

  try {
    const sw = await getWorker(context);
    assert.ok(sw, "service worker should be present");

    // Turn SCATERNET on BEFORE navigating -> tests the on-load apply path.
    await setEnabled(sw, true);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });

    await page.waitForFunction(
      () => {
        const img = document.getElementById("hero");
        return img && (img.getAttribute("src") || "").startsWith("chrome-extension://");
      },
      { timeout: 8000 }
    );

    await t.test("images are swapped for bundled jazz-ska hybrids", async () => {
      const heroSrc = await page.$eval("#hero", (i) => i.getAttribute("src"));
      assert.ok(heroSrc.startsWith("chrome-extension://"), heroSrc);
      assert.match(heroSrc, /assets\/images\/img-\d+\.(jpe?g|png|webp)$/);
      const swapped = await page.$eval("#hero", (i) => i.dataset.scaternetSwapped);
      assert.equal(swapped, "1");
      const origStashed = await page.$eval("#hero", (i) => i.getAttribute("data-scaternet-src"));
      assert.ok(origStashed.startsWith("data:image/svg"), "original stashed for restore");
    });

    await t.test("CSS background-image is swapped", async () => {
      const bg = await page.$eval("#bg", (e) => getComputedStyle(e).backgroundImage);
      assert.match(bg, /chrome-extension:\/\/.*img-\d+\.(jpe?g|png|webp)/);
    });

    await t.test("visible text is scatified into styled spans", async () => {
      const h1 = await page.$eval("#title", (e) => e.textContent);
      assert.match(h1, SCAT_RE, `title not scatified: ${h1}`);
      // original English words are gone from visible copy.
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      assert.doesNotMatch(bodyText, /\bquick\b|\bwelcome\b|\bmorning\b/, "original words leaked");
      // scat words are wrapped in styled spans (varied size/font).
      const wordCount = await page.evaluate(() => document.querySelectorAll(".scaternet-word").length);
      assert.ok(wordCount > 0, "no .scaternet-word spans");
      const hasSize = await page.evaluate(
        () => !!document.querySelector('[class*="scat-size-"]') && !!document.querySelector('[class*="scat-font-"]')
      );
      assert.ok(hasSize, "scat spans missing size/font classes");
    });

    await t.test("document title is scatified", async () => {
      const title = await page.title();
      assert.notEqual(title, "Scat Test Page");
      assert.match(title, SCAT_RE, `title: ${title}`);
    });

    await t.test("brown stains overlay is present", async () => {
      const stains = await page.evaluate(() => {
        const c = document.getElementById("scaternet-stains");
        return c ? c.querySelectorAll(".scaternet-stain").length : 0;
      });
      assert.ok(stains > 0, "no brown stains scattered");
    });

    await t.test("form inputs and contenteditable are left untouched", async () => {
      assert.equal(await page.$eval("#inp", (e) => e.value), "secret123");
      assert.equal(await page.$eval("#ta", (e) => e.value), "keep me typed exactly");
      assert.equal(await page.$eval("#editable", (e) => e.textContent), "editable stays typeable");
    });

    await t.test("video is NOT muted (we layer, not silence)", async () => {
      // The intended cacophony: we play a ska track OVER the original, never mute it.
      assert.equal(await page.$eval("#vid", (v) => v.muted), false);
    });

    await t.test("dynamically added content is scatified (MutationObserver)", async () => {
      await page.waitForFunction(
        () => {
          const p = document.getElementById("later");
          return p && p.querySelector(".scaternet-word");
        },
        { timeout: 5000 }
      );
      await page.waitForFunction(
        () => {
          const i = document.getElementById("dynimg");
          return i && i.dataset.scaternetSwapped === "1";
        },
        { timeout: 5000 }
      );
    });

    await t.test("a hijacked/lazy image src is re-swapped (YouTube-style)", async () => {
      await page.waitForFunction(
        () => {
          const img = document.getElementById("lazy");
          if (!img) return false;
          const src = img.getAttribute("src") || "";
          const stash = img.getAttribute("data-scaternet-src") || "";
          return src.startsWith("chrome-extension://") && stash.startsWith("data:image/png");
        },
        { timeout: 4000 }
      );
    });

    // Capture a store screenshot while the page is fully scatified.
    mkdirSync(join(EXT, "store", "screenshots"), { recursive: true });
    await page.screenshot({ path: join(EXT, "store", "screenshots", "hero-scatified.png") });

    await t.test("toggling OFF restores the page in place", async () => {
      await setEnabled(sw, false);
      await page.waitForFunction(
        () => {
          const img = document.getElementById("hero");
          const src = img && img.getAttribute("src");
          return src && src.startsWith("data:image/svg");
        },
        { timeout: 6000 }
      );
      const h1 = await page.$eval("#title", (e) => e.textContent);
      assert.equal(h1, "Welcome to the original human internet");
      const heroSwapped = await page.$eval("#hero", (i) => i.dataset.scaternetSwapped || "");
      assert.equal(heroSwapped, "");
      const bg = await page.$eval("#bg", (e) => getComputedStyle(e).backgroundImage);
      assert.doesNotMatch(bg, /img-\d+\.(jpe?g|png|webp)/);
      const title = await page.title();
      assert.equal(title, "Scat Test Page");
      const stains = await page.evaluate(() => !!document.getElementById("scaternet-stains"));
      assert.equal(stains, false, "stains not removed on restore");
    });

    await t.test("bundled image paints under a strict img-src 'self' CSP", async () => {
      await setEnabled(sw, true);
      const cspPage = await context.newPage();
      await cspPage.goto(url + "csp", { waitUntil: "load" });
      await cspPage.waitForFunction(
        () => {
          const img = document.getElementById("csphero");
          return img && (img.getAttribute("src") || "").startsWith("chrome-extension://");
        },
        { timeout: 8000 }
      );
      await cspPage.waitForFunction(
        () => {
          const img = document.getElementById("csphero");
          return img && img.complete && img.naturalWidth > 2;
        },
        { timeout: 8000 }
      );
      const natW = await cspPage.$eval("#csphero", (i) => i.naturalWidth);
      assert.ok(natW > 2, `image should have painted under CSP, naturalWidth=${natW}`);
      await cspPage.close();
    });
  } finally {
    await context.close();
    server.close();
  }
});
