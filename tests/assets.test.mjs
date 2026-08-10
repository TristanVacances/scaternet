/*
 * Asset-integrity tests: the generated manifests must reference files that
 * actually exist, and manifest.json must wire them in the right order. Catches a
 * build that silently shipped an empty/stale image or audio pack.
 *
 * Run:  node --test tests/assets.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

function runGlobals(relPath) {
  const sandbox = {};
  vm.createContext(sandbox);
  sandbox.globalThis = sandbox;
  vm.runInContext(readFileSync(join(ROOT, relPath), "utf8"), sandbox);
  return sandbox;
}

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));

test("bundled images: manifest lists real image files", () => {
  const { ScaternetImagesList } = runGlobals("src/images-manifest.js");
  assert.ok(Array.isArray(ScaternetImagesList), "ScaternetImagesList should be an array");
  assert.ok(ScaternetImagesList.length >= 30, `too few images: ${ScaternetImagesList.length}`);
  for (const f of ScaternetImagesList) {
    assert.match(f, /\.(png|jpe?g|webp)$/i, `unexpected image name: ${f}`);
    assert.ok(existsSync(join(ROOT, "assets", "images", f)), `missing image file: ${f}`);
  }
});

test("bundled audio: scats + farts manifests list real files", () => {
  const { ScaternetAudioAssets } = runGlobals("src/audio-manifest.js");
  assert.ok(ScaternetAudioAssets && typeof ScaternetAudioAssets === "object");
  for (const cat of ["music", "video", "scats", "farts"]) {
    assert.ok(Array.isArray(ScaternetAudioAssets[cat]), `${cat} should be an array`);
    for (const f of ScaternetAudioAssets[cat]) {
      assert.match(f, /\.(mp3|ogg|wav|m4a|webm)$/i, `bad audio name: ${f}`);
      assert.ok(existsSync(join(ROOT, "assets", "audio", cat, f)), `missing ${cat} file: ${f}`);
    }
  }
  assert.ok(ScaternetAudioAssets.scats.length >= 3, `too few scats: ${ScaternetAudioAssets.scats.length}`);
  assert.ok(ScaternetAudioAssets.farts.length >= 3, `too few farts: ${ScaternetAudioAssets.farts.length}`);
});

test("manifest.json wires content scripts in the right load order", () => {
  const js = manifest.content_scripts[0].js;
  for (const f of [
    "src/state.js", "src/scatify-text.js", "src/images-manifest.js", "src/swap-images.js",
    "src/audio-manifest.js", "src/scat-audio.js", "src/content.js",
  ]) {
    assert.ok(js.includes(f), `content_scripts missing ${f}`);
  }
  assert.ok(js.indexOf("src/images-manifest.js") < js.indexOf("src/swap-images.js"));
  assert.ok(js.indexOf("src/audio-manifest.js") < js.indexOf("src/scat-audio.js"));
  assert.ok(js.indexOf("src/scatify-text.js") < js.indexOf("src/content.js"));
});

test("manifest.json exposes images and audio as web-accessible", () => {
  const res = manifest.web_accessible_resources.flatMap((r) => r.resources);
  assert.ok(res.includes("assets/images/*"), "images not web-accessible");
  assert.ok(res.includes("assets/audio/*"), "audio not web-accessible");
});

test("no host_permissions (everything is bundled)", () => {
  assert.ok(!manifest.host_permissions || manifest.host_permissions.length === 0);
  assert.deepEqual(manifest.permissions, ["storage"]);
});

test("all icon files referenced by the manifest exist", () => {
  const icons = Object.values(manifest.icons).concat(Object.values(manifest.action.default_icon));
  for (const p of icons) assert.ok(existsSync(join(ROOT, p)), `missing icon: ${p}`);
});
