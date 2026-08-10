/*
 * Generate Chrome Web Store screenshots (and visually verify the popup) by loading
 * the real extension. Captures popup OFF/ON and a woofed demo page at 1280x800.
 *
 * Run:  node tools/screenshots.mjs
 */
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const OUT = join(EXT, "store", "screenshots");
mkdirSync(OUT, { recursive: true });
const FIXTURE = readFileSync(join(EXT, "tests", "fixtures", "sample.html"), "utf8");

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(FIXTURE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "shots-")), {
  channel: "chromium",
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent("serviceworker");
const extId = sw.url().split("/")[2];

// Popup OFF
const popup = await context.newPage();
await popup.setViewportSize({ width: 260, height: 240 });
await popup.goto(`chrome-extension://${extId}/src/popup.html`);
await popup.waitForSelector("#toggle");
await popup.screenshot({ path: join(OUT, "popup-off.png") });

// Popup ON (click the toggle)
await popup.click("#toggle");
await popup.waitForFunction(() => document.getElementById("toggle").classList.contains("on"));
await popup.screenshot({ path: join(OUT, "popup-on.png") });

// Woofed demo page at store size
const page = await context.newPage();
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(
  () => {
    const i = document.getElementById("hero");
    return i && (i.getAttribute("src") || "").startsWith("chrome-extension://");
  },
  { timeout: 8000 }
);
await page.waitForTimeout(600); // let dynamic content + dogs settle
await page.screenshot({ path: join(OUT, "demo-1280x800.png") });

console.log("Screenshots written to", OUT);
await context.close();
server.close();
