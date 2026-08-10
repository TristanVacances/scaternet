/*
 * Unit tests for the pure text→scat engine (src/scatify-text.js).
 * The engine assigns globalThis.ScaternetText, so we run its source in a node:vm
 * sandbox and read the API back out — same file, no bundler, no duplicate logic.
 *
 * Run:  node --test tests/scatify-text.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "scatify-text.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
sandbox.globalThis = sandbox;
vm.runInContext(src, sandbox, { filename: "scatify-text.js" });
const { scatifyWord, scatifyText, scatifyTokens, hashString, SIZES, FONTS, EMOJIS } =
  sandbox.ScaternetText;

// A deterministic rng that cycles through a fixed list (for token tests).
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const isScat = (w) => /^[a-z]+$/.test(w); // lowercase syllable blob

test("exports the API", () => {
  assert.equal(typeof scatifyWord, "function");
  assert.equal(typeof scatifyText, "function");
  assert.equal(typeof scatifyTokens, "function");
  assert.ok(Array.isArray(SIZES) && Array.isArray(FONTS) && Array.isArray(EMOJIS));
});

test("a simple word becomes a lowercase scat blob", () => {
  const out = scatifyWord("hello");
  assert.ok(isScat(out), `expected scat blob, got ${out}`);
  assert.ok(out.length >= 2);
});

test("every word becomes scat, whitespace preserved exactly", () => {
  const input = "the quick brown fox";
  const out = scatifyText(input);
  const skeleton = out.replace(/[a-z]+/gi, "X");
  assert.equal(skeleton, "X X X X");
});

test("whitespace (single, multiple, newlines, tabs) is preserved", () => {
  const out = scatifyText("a  b\nc\td");
  const skeleton = out.replace(/[a-z]+/gi, "X");
  assert.equal(skeleton, "X  X\nX\tX");
});

test("leading & trailing punctuation preserved", () => {
  assert.match(scatifyWord("world!"), /!$/);
  assert.match(scatifyWord("(hi)"), /^\(/);
  assert.match(scatifyWord("(hi)"), /\)$/);
  assert.match(scatifyWord('"quote"'), /^"/);
});

test("blob length scales with word length", () => {
  const short = scatifyWord("hi").length;
  const long = scatifyWord("internationalization").length;
  assert.ok(long > short, `long ${long} should exceed short ${short}`);
});

test("output is deterministic (word layer)", () => {
  assert.equal(scatifyText("Deterministic output, please!"), scatifyText("Deterministic output, please!"));
  assert.equal(scatifyWord("internet"), scatifyWord("internet"));
});

test("edge cases: null / undefined / empty / whitespace-only / non-string", () => {
  assert.equal(scatifyText(null), "");
  assert.equal(scatifyText(undefined), "");
  assert.equal(scatifyText(""), "");
  assert.equal(scatifyText("   "), "   ");
  assert.equal(scatifyText("\n\t "), "\n\t ");
  assert.equal(scatifyText(42), "");
});

test("pure-punctuation tokens are left untouched", () => {
  assert.equal(scatifyWord("!!!"), "!!!");
  assert.equal(scatifyWord("—"), "—");
  assert.equal(scatifyText(":-) ... !"), ":-) ... !");
});

test("no crash on emoji / non-latin", () => {
  assert.doesNotThrow(() => scatifyText("Café 北京 🐶 test"));
});

// ---- token layer ----
test("scatifyTokens: word tokens carry valid size + font classes", () => {
  const tokens = scatifyTokens("the quick brown fox", { rng: seqRng([0.5]) });
  const words = tokens.filter((t) => t.kind === "word");
  assert.ok(words.length >= 4);
  for (const w of words) {
    assert.ok(SIZES.includes(w.size), `bad size ${w.size}`);
    assert.ok(FONTS.includes(w.font), `bad font ${w.font}`);
  }
});

test("scatifyTokens: spaces preserved as space tokens (no emoji)", () => {
  const tokens = scatifyTokens("a b", { rng: () => 0.5, emoji: 0 });
  assert.equal(tokens.filter((t) => t.kind === "space").length, 1);
  const rebuilt = tokens.map((t) => t.text).join("");
  assert.match(rebuilt, /^[a-z]+ [a-z]+$/, `unexpected rebuild: ${rebuilt}`);
});

test("scatifyTokens: caps=1 uppercases every word; caps=0 leaves lowercase", () => {
  const allCaps = scatifyTokens("the quick brown", { rng: () => 0, caps: 1, emoji: 0 });
  for (const w of allCaps.filter((t) => t.kind === "word")) {
    assert.equal(w.text, w.text.toUpperCase(), `not caps: ${w.text}`);
  }
  const noCaps = scatifyTokens("the quick brown", { rng: () => 0.99, caps: 0, emoji: 0 });
  for (const w of noCaps.filter((t) => t.kind === "word")) {
    assert.equal(w.text, w.text.toLowerCase(), `not lower: ${w.text}`);
  }
});

test("scatifyTokens: emoji=1 injects a jazz emoji after each word", () => {
  const tokens = scatifyTokens("one two", { rng: () => 0.99, caps: 0, emoji: 1 });
  const emojis = tokens.filter((t) => t.kind === "emoji");
  assert.ok(emojis.length >= 2, `expected emoji tokens, got ${emojis.length}`);
  for (const e of emojis) assert.ok(EMOJIS.includes(e.text), `unknown emoji ${e.text}`);
});

test("scatifyTokens: emoji=0 injects no emoji", () => {
  const tokens = scatifyTokens("one two three", { rng: () => 0.5, emoji: 0 });
  assert.equal(tokens.filter((t) => t.kind === "emoji").length, 0);
});

test("scatifyTokens: empty / whitespace inputs", () => {
  assert.equal(scatifyTokens("", { rng: () => 0.5 }).length, 0);
  const ws = scatifyTokens("   ", { rng: () => 0.5 });
  assert.equal(ws.length, 1);
  assert.equal(ws[0].kind, "space");
});
