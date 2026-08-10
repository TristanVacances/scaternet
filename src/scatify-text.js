/*
 * SCATERNET — text→scat engine (pure, side-effect free)
 *
 * Exposes globalThis.ScaternetText = {
 *   scatifyWord, scatifyText, scatifyTokens, hashString, SYLLABLES, EMOJIS, SIZES, FONTS
 * }.
 * No import/export so this same file runs both as an MV3 content script and,
 * loaded via node:vm, under the unit tests.
 *
 * Two layers:
 *  - WORD layer (deterministic, hash-seeded): each original word becomes one scat
 *    "blob" ("skabidibidou") whose length scales with the original word. Stable
 *    across runs, so it's unit-testable. Leading/trailing punctuation preserved,
 *    whitespace preserved exactly.
 *  - TOKEN layer (scatifyTokens): wraps the scat string into styled tokens with
 *    random size / font / CAPS / interspersed jazz emoji (an injectable rng lets
 *    tests be deterministic). This is what the DOM builder in content.js consumes.
 */
(function () {
  "use strict";

  // FNV-1a 32-bit hash -> unsigned int. Stable across runs => stable output.
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // Scat syllables the blobs are built from. Deliberately silly.
  const SYLLABLES = [
    "ska", "bi", "di", "dou", "bou", "da", "ba", "boo", "doo", "bap",
    "boop", "dweet", "dee", "dap", "skat", "zoo", "wah", "be", "bo", "doob",
    "reet", "dooby", "shoo", "yab", "dip", "bidi", "skabi", "doobi",
  ];
  const VOWELS = "aeiou";

  // Jazz / music emoji sprinkled between scat words (Tristan).
  const EMOJIS = ["🎷", "🎺", "🎸", "🥁", "🎶", "🎵", "🎼", "🎙️", "🪗", "🎹"];

  // CSS class suffixes wired in content.css.
  const SIZES = ["xs", "sm", "md", "md", "lg", "xl"]; // md weighted (most text normal-ish)
  const FONTS = ["1", "2", "3", "4", "5"];

  const LEAD_RE = /^[^\p{L}\p{N}]+/u;
  const TRAIL_RE = /[^\p{L}\p{N}]+$/u;
  const HAS_ALNUM_RE = /[\p{L}\p{N}]/u;

  function splitToken(token) {
    if (!HAS_ALNUM_RE.test(token)) return ["", "", token];
    const lead = (token.match(LEAD_RE) || [""])[0];
    const trail = (token.match(TRAIL_RE) || [""])[0];
    const core = token.slice(lead.length, token.length - trail.length);
    return [lead, core, trail];
  }

  // Stretch the final vowel of a syllable, e.g. "boo" -> "boooo" (varied spelling).
  function stretch(syll, amount) {
    const m = syll.match(/[aeiou](?=[^aeiou]*$)/i);
    if (!m) return syll + syll[syll.length - 1].repeat(amount);
    const idx = m.index;
    return syll.slice(0, idx) + syll[idx].repeat(1 + amount) + syll.slice(idx + 1);
  }

  /**
   * Turn ONE whitespace-free token into a scat blob, preserving surrounding
   * punctuation. Deterministic in the token. Returns lowercase (case handled by
   * the token layer). e.g. "internet" -> "skabidoubap", "the" -> "skabi".
   */
  function scatifyWord(token) {
    if (!token) return token;
    const [lead, core, trail] = splitToken(token);
    if (!core) return token;

    const h = hashString(core.toLowerCase());
    const len = core.length;
    // syllable count scales with original word length, with a little jitter.
    const jitter = (h % 3) - 1; // -1, 0, +1
    const count = clamp(Math.round(len / 2) + jitter, 1, 8);

    let out = "";
    for (let i = 0; i < count; i++) {
      const hi = hashString(core.toLowerCase() + "#" + i);
      let syll = SYLLABLES[hi % SYLLABLES.length];
      // ~1 in 4 syllables gets a stretched vowel for silly spelling.
      if (hi % 4 === 0) syll = stretch(syll, 1 + (hi % 4));
      out += syll;
    }
    return lead + out + trail;
  }

  /**
   * Transform a run of text into a scat string, preserving all whitespace.
   * Used for <title> and as the textual base. Deterministic.
   */
  function scatifyText(text) {
    if (text == null || typeof text !== "string") return "";
    if (text.trim() === "") return text;
    return text
      .split(/(\s+)/)
      .map((tok) => (/^\s+$/.test(tok) || tok === "" ? tok : scatifyWord(tok)))
      .join("");
  }

  /**
   * Token layer for the DOM builder. Returns an array of tokens:
   *   { kind: "space", text }
   *   { kind: "word",  text, size, font }     // text may be UPPERCASED
   *   { kind: "emoji", text }
   * @param {string} text
   * @param {{rng?: () => number, caps?: number, emoji?: number}} [opts]
   */
  function scatifyTokens(text, opts) {
    const o = opts || {};
    const rng = typeof o.rng === "function" ? o.rng : Math.random;
    const capsRatio = typeof o.caps === "number" ? o.caps : 0.15; // ~15% ALL CAPS
    const emojiRatio = typeof o.emoji === "number" ? o.emoji : 0.28; // chance of emoji after a word
    if (text == null || typeof text !== "string" || text.trim() === "") {
      return text ? [{ kind: "space", text }] : [];
    }
    const tokens = [];
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        tokens.push({ kind: "space", text: part });
        continue;
      }
      let scat = scatifyWord(part);
      const caps = rng() < capsRatio;
      if (caps) scat = scat.toUpperCase();
      tokens.push({
        kind: "word",
        text: scat,
        size: SIZES[(rng() * SIZES.length) | 0],
        font: FONTS[(rng() * FONTS.length) | 0],
      });
      if (rng() < emojiRatio) {
        tokens.push({ kind: "emoji", text: EMOJIS[(rng() * EMOJIS.length) | 0] });
      }
    }
    return tokens;
  }

  const api = { scatifyWord, scatifyText, scatifyTokens, hashString, SYLLABLES, EMOJIS, SIZES, FONTS };
  if (typeof globalThis !== "undefined") globalThis.ScaternetText = api;
})();
