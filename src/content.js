/*
 * SCATERNET — content orchestrator.
 * Scatifies text (into styled spans: varied size/font/CAPS + jazz emoji), swaps
 * images for jazz×ska hybrids / turds, scatters brown stains, and drives the
 * audio. Keeps dynamic pages chaotic via a MutationObserver. Reacts to
 * chrome.storage changes so the toolbar/popup toggle needs no messaging.
 *
 * Depends (same isolated world, loaded before this file):
 *   ScaternetState, ScaternetText, ScaternetImages, ScaternetAudio,
 *   ScaternetImagesList, ScaternetAudioAssets.
 */
(function () {
  "use strict";

  const T = globalThis.ScaternetText;
  const IMG = globalThis.ScaternetImages;
  const AUD = globalThis.ScaternetAudio;
  const State = globalThis.ScaternetState;

  const isTop = (function () {
    try { return window.top === window; } catch (_e) { return true; }
  })();

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "TITLE"]);
  let processed = new WeakSet();
  const originals = []; // { wrapper, node } for exact text restore
  let observer = null;
  let active = false;
  let titleOriginal = null;

  function isOurs(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === "scaternet-stains") return true;
    if (el.closest) {
      return !!(el.closest("[data-scaternet-text]") || el.closest("#scaternet-stains"));
    }
    return false;
  }

  function shouldSkip(textNode) {
    if (processed.has(textNode)) return true;
    const v = textNode.nodeValue;
    if (!v || v.trim() === "") return true;
    const parent = textNode.parentNode;
    if (!parent || parent.nodeType !== 1) return true;
    if (SKIP_TAGS.has(parent.tagName)) return true;
    if (parent.isContentEditable) return true;
    if (isOurs(parent)) return true; // never re-scatify our own scat / stains
    return false;
  }

  // Build a <span data-scaternet-text> holding styled scat words + emoji.
  function scatFragment(text) {
    const tokens = T.scatifyTokens(text);
    const wrapper = document.createElement("span");
    wrapper.dataset.scaternetText = "1";
    for (const tk of tokens) {
      if (tk.kind === "space") {
        wrapper.appendChild(document.createTextNode(tk.text));
      } else if (tk.kind === "emoji") {
        const e = document.createElement("span");
        e.className = "scaternet-emoji";
        e.textContent = tk.text;
        wrapper.appendChild(e);
      } else {
        const w = document.createElement("span");
        // Keep the page's own font (Tristan) — only vary size. No font-family swap.
        w.className = "scaternet-word scat-size-" + tk.size;
        w.textContent = tk.text;
        wrapper.appendChild(w);
      }
    }
    return wrapper;
  }

  function scatTextNode(node) {
    if (shouldSkip(node)) return;
    const parent = node.parentNode;
    if (!parent) return;
    const original = node.nodeValue;
    const wrapper = scatFragment(original);
    try {
      parent.replaceChild(wrapper, node);
    } catch (_e) {
      processed.add(node);
      return;
    }
    // `node` is now detached; keep it to restore the exact original character data.
    originals.push({ wrapper, node });
  }

  function walkText(root) {
    const start = root && root.nodeType === 1 ? root : document.body;
    if (!start) return;
    if (isOurs(start)) return;
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, null);
    const batch = [];
    let n;
    while ((n = walker.nextNode())) batch.push(n);
    for (const node of batch) scatTextNode(node);
  }

  function scatTitle() {
    if (document.title && titleOriginal === null) {
      titleOriginal = document.title;
      document.title = T.scatifyText(document.title);
    }
  }

  // ---- brown stains (top frame only): real splatter PNGs scattered around ----
  function stainURL(file) {
    try { return chrome.runtime.getURL("assets/stains/" + file); }
    catch (_e) { return "assets/stains/" + file; }
  }
  function addStains() {
    if (!isTop) return;
    if (document.getElementById("scaternet-stains")) return;
    const list = globalThis.ScaternetStainsList || [];
    const host = document.body || document.documentElement;
    if (!host || list.length === 0) return;
    const c = document.createElement("div");
    c.id = "scaternet-stains";
    const count = 14 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      const file = list[(Math.random() * list.length) | 0];
      const img = document.createElement("img");
      img.className = "scaternet-stain";
      img.setAttribute("alt", "");
      img.src = stainURL(file); // set before insertion so the observer never sees a swap-eligible img
      const w = 130 + Math.random() * 380;
      img.style.width = w.toFixed(0) + "px";
      img.style.left = (Math.random() * 100).toFixed(1) + "vw";
      img.style.top = (Math.random() * 100).toFixed(1) + "vh";
      const rot = (Math.random() * 360).toFixed(0);
      const flip = Math.random() < 0.5 ? -1 : 1;
      img.style.transform = "translate(-40%,-40%) rotate(" + rot + "deg) scaleX(" + flip + ")";
      img.style.opacity = (0.7 + Math.random() * 0.3).toFixed(2);
      c.appendChild(img);
    }
    host.appendChild(c);
  }
  function removeStains() {
    const c = document.getElementById("scaternet-stains");
    if (c) c.remove();
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === "attributes") {
        if (m.target && m.target.nodeType === 1 && m.target.tagName === "IMG") {
          if (!isOurs(m.target)) IMG.ensureImg(m.target);
        }
        continue;
      }
      for (const node of m.addedNodes) {
        if (node.nodeType === 3) {
          scatTextNode(node);
        } else if (node.nodeType === 1) {
          if (isOurs(node)) continue; // our own scat spans / stains — ignore
          walkText(node);
          IMG.processTree(node);
          if (node.tagName === "VIDEO") AUD.handleMedia(node);
          node.querySelectorAll && node.querySelectorAll("video").forEach((el) => AUD.handleMedia(el));
        }
      }
    }
  }

  async function enable() {
    if (active) return;
    active = true;
    processed = new WeakSet();
    const st = await State.get();
    scatTitle();
    walkText(document.body);
    IMG.processTree(document.body || document.documentElement);
    addStains();
    AUD.start({ volume: st.volume, muteAudio: st.muteAudio, layerOverVideos: st.layerOverVideos });
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset"], // catch lazy/hijacked images
    });
  }

  function disable() {
    if (!active) return;
    active = false;
    if (observer) { observer.disconnect(); observer = null; }
    // Restore text: put each original text node back where its wrapper is.
    for (const { wrapper, node } of originals) {
      try {
        if (wrapper && wrapper.parentNode) wrapper.replaceWith(node);
      } catch (_e) { /* detached — ignore */ }
    }
    originals.length = 0;
    IMG.restoreAll();
    removeStains();
    AUD.stop();
    if (titleOriginal !== null) {
      document.title = titleOriginal;
      titleOriginal = null;
    }
  }

  function applyState(st) {
    if (st.enabled) enable();
    else disable();
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if ("enabled" in changes) applyState({ enabled: changes.enabled.newValue });
      if (active) {
        if ("volume" in changes) AUD.setVolume(changes.volume.newValue);
        if ("muteAudio" in changes) AUD.setMute(changes.muteAudio.newValue);
        if ("layerOverVideos" in changes) AUD.setLayerOverVideos(changes.layerOverVideos.newValue);
      }
    });
  } catch (_e) { /* no chrome.storage (e.g. under test harness) */ }

  State.get().then(applyState);

  // Expose for e2e tests to drive without the toolbar.
  globalThis.__scaternet = { enable, disable };
})();
