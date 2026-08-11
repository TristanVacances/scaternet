/*
 * Store screenshots: load an unpacked extension, visit youtube.com, capture a
 * BEFORE (extension off) and AFTER (toggled on) shot at 1280x800.
 *
 * Usage: node store-shots-yt.mjs <extDir> <outDir> <prefix> [url]
 */
import { chromium } from "playwright";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = process.argv[2];
const OUTDIR = process.argv[3];
const PREFIX = process.argv[4];
const URL = process.argv[5] || "https://www.youtube.com";

async function getWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15000 });
  return sw;
}

async function dismissConsent(page) {
  // EU consent wall: reject-all is the privacy-preserving choice.
  const labels = [/reject all/i, /tout refuser/i, /alle ablehnen/i, /reject the use/i, /decline/i];
  for (const rx of labels) {
    try {
      const btn = page.getByRole("button", { name: rx });
      if (await btn.count()) { await btn.first().click({ timeout: 4000 }); await page.waitForTimeout(3500); return true; }
    } catch (_e) {}
  }
  // sometimes inside an iframe
  for (const frame of page.frames()) {
    for (const rx of labels) {
      try {
        const btn = frame.getByRole("button", { name: rx });
        if (await btn.count()) { await btn.first().click({ timeout: 4000 }); await page.waitForTimeout(3500); return true; }
      } catch (_e) {}
    }
  }
  return false;
}

(async () => {
  mkdirSync(OUTDIR, { recursive: true });
  const userDataDir = mkdtempSync(join(tmpdir(), "shots-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    const sw = await getWorker(context);
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await dismissConsent(page);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: join(OUTDIR, `${PREFIX}-before.png`) });
    console.log("BEFORE saved:", page.url());

    // Toggle ON, then RELOAD so the extension is active from page load and swaps
    // each thumbnail as it lazy-loads (avoids the "toggled after load" timing gap).
    await sw.evaluate(() => new Promise((r) => chrome.storage.local.set({ enabled: true }, r)));
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await dismissConsent(page);
    await page.waitForTimeout(2500);
    // nudge lazy-loading: scroll down to force thumbnails to load (they get swapped
    // as they appear), then back to the top, and let the swaps settle.
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(1200); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(OUTDIR, `${PREFIX}-after.png`) });
    console.log("AFTER saved");
  } finally {
    await context.close();
  }
})();
