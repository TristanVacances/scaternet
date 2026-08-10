/*
 * SCATERNET — image swapper.
 * Exposes globalThis.ScaternetImages = { processTree, restoreAll, swapImage, ensureImg }.
 *
 * Every <img>, <picture> <source>, CSS background-image and <video poster> is
 * repointed at a bundled jazz×ska hybrid (or a cartoon turd/bum). All assets are
 * bundled at the chrome-extension:// origin so they load even under a page's
 * strict Content-Security-Policy. Originals are stashed in data-attributes so
 * restore is exact. (No runtime network — unlike CHIENTERNET's dog.ceo upgrade.)
 */
(function () {
  "use strict";

  const MARK = "scaternetSwapped"; // dataset key -> data-scaternet-swapped
  const bundled = (globalThis.ScaternetImagesList || []).slice();

  function extURL(file) {
    try {
      return chrome.runtime.getURL("assets/images/" + file);
    } catch (_e) {
      return "assets/images/" + file; // test/non-extension context
    }
  }

  function nextImage() {
    if (bundled.length === 0) return null;
    // Random per image -> a different mix on every page.
    const file = bundled[(Math.random() * bundled.length) | 0];
    return extURL(file);
  }

  function isTiny(img) {
    const w = img.naturalWidth || img.width || parseInt(img.getAttribute("width"), 10) || 0;
    const h = img.naturalHeight || img.height || parseInt(img.getAttribute("height"), 10) || 0;
    // Only skip if we KNOW it is a tracking pixel (both dims present and <=2).
    return w > 0 && h > 0 && w <= 2 && h <= 2;
  }

  function swapImage(img) {
    if (!img || img.dataset[MARK] === "1") return;
    if (isTiny(img)) return;
    const pic = nextImage();
    if (!pic) return;
    img.dataset[MARK] = "1";
    img.setAttribute("data-scaternet-src", img.getAttribute("src") || "");
    if (img.hasAttribute("srcset")) {
      img.setAttribute("data-scaternet-srcset", img.getAttribute("srcset"));
      img.removeAttribute("srcset"); // stop the browser overriding our src
    }
    // Neutralise <picture> <source> siblings so they can't win.
    const parent = img.closest("picture");
    if (parent) {
      parent.querySelectorAll("source").forEach((s) => {
        if (!s.dataset.scaternetSource) {
          s.dataset.scaternetSource = "1";
          if (s.hasAttribute("srcset")) {
            s.setAttribute("data-scaternet-srcset", s.getAttribute("srcset"));
            s.removeAttribute("srcset");
          }
        }
      });
    }
    img.setAttribute("src", pic);
  }

  // Called when an <img>'s src/srcset changes. Handles a lazy image that just got
  // a real src, and a site (YouTube etc.) re-setting src AFTER we swapped.
  function ensureImg(img) {
    if (!img || img.tagName !== "IMG") return;
    const cur = img.getAttribute("src") || "";
    if (cur.startsWith("chrome-extension://")) return; // already ours
    if (img.dataset[MARK] === "1") {
      if (cur) img.setAttribute("data-scaternet-src", cur);
      if (img.hasAttribute("srcset")) {
        img.setAttribute("data-scaternet-srcset", img.getAttribute("srcset"));
        img.removeAttribute("srcset");
      }
      const pic = nextImage();
      if (pic) img.setAttribute("src", pic);
    } else {
      swapImage(img);
    }
  }

  function swapPoster(video) {
    if (!video || video.dataset[MARK] === "1") return;
    const pic = nextImage();
    if (!pic) return;
    video.dataset[MARK] = "1";
    video.setAttribute("data-scaternet-poster", video.getAttribute("poster") || "");
    video.setAttribute("poster", pic);
  }

  function swapBackground(el) {
    if (!el || el.nodeType !== 1 || el.dataset.scaternetBg === "1") return;
    let bg;
    try {
      bg = getComputedStyle(el).backgroundImage;
    } catch (_e) {
      return;
    }
    if (!bg || bg === "none" || bg.indexOf("url(") === -1) return;
    const pic = nextImage();
    if (!pic) return;
    el.dataset.scaternetBg = "1";
    el.setAttribute("data-scaternet-bgstyle", el.style.backgroundImage || "");
    el.style.backgroundImage = 'url("' + pic + '")';
  }

  function processTree(root) {
    if (!root || bundled.length === 0) return;
    const scope = root.nodeType === 1 || root.nodeType === 9 ? root : document;
    scope.querySelectorAll ? scope.querySelectorAll("img").forEach(swapImage) : null;
    if (scope.tagName === "IMG") swapImage(scope);
    scope.querySelectorAll && scope.querySelectorAll("video[poster]").forEach(swapPoster);
    if (scope.querySelectorAll) {
      const els = scope.querySelectorAll("*");
      for (let i = 0; i < els.length; i++) swapBackground(els[i]);
      if (scope.nodeType === 1) swapBackground(scope);
    }
  }

  function restoreAll() {
    document.querySelectorAll('[data-scaternet-swapped="1"]').forEach((el) => {
      if (el.tagName === "IMG") {
        const orig = el.getAttribute("data-scaternet-src");
        if (orig !== null) el.setAttribute("src", orig);
        const ss = el.getAttribute("data-scaternet-srcset");
        if (ss !== null) el.setAttribute("srcset", ss);
      } else if (el.tagName === "VIDEO") {
        const p = el.getAttribute("data-scaternet-poster");
        if (p !== null && p !== "") el.setAttribute("poster", p);
        else el.removeAttribute("poster");
      }
      el.removeAttribute("data-scaternet-src");
      el.removeAttribute("data-scaternet-srcset");
      el.removeAttribute("data-scaternet-poster");
      delete el.dataset[MARK];
    });
    document.querySelectorAll('[data-scaternet-source="1"]').forEach((s) => {
      const ss = s.getAttribute("data-scaternet-srcset");
      if (ss !== null) s.setAttribute("srcset", ss);
      s.removeAttribute("data-scaternet-srcset");
      delete s.dataset.scaternetSource;
    });
    document.querySelectorAll('[data-scaternet-bg="1"]').forEach((el) => {
      el.style.backgroundImage = el.getAttribute("data-scaternet-bgstyle") || "";
      el.removeAttribute("data-scaternet-bgstyle");
      delete el.dataset.scaternetBg;
    });
  }

  globalThis.ScaternetImages = { processTree, restoreAll, swapImage, ensureImg };
})();
