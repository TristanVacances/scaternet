/*
 * SCATERNET — shared state (chrome.storage.local wrapper).
 * Exposes globalThis.ScaternetState = { DEFAULTS, get, set }.
 * Used by the content script and the popup; the toolbar toggle and the popup
 * both write here, and content scripts react via chrome.storage.onChanged —
 * so there is no message passing and no "tabs" permission.
 */
(function () {
  "use strict";
  const DEFAULTS = {
    enabled: false,
    muteAudio: false, // kill switch for all sound (page usable in polite company)
    volume: 0.7, // master volume for music + scats + farts (0..1); louder overall per Tristan
    layerOverVideos: true, // layer a ska track over videos (the intended cacophony)
  };

  function get() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(DEFAULTS, (v) => resolve(Object.assign({}, DEFAULTS, v)));
      } catch (_e) {
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  function set(patch) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(patch, () => resolve());
      } catch (_e) {
        resolve();
      }
    });
  }

  globalThis.ScaternetState = { DEFAULTS, get, set };
})();
