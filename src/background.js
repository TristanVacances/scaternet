/*
 * SCATERNET — service worker.
 *  - Toolbar click toggles `enabled` in storage (content scripts react on their own).
 *  - Keeps the toolbar icon in sync (colour = on, grey = off).
 * No network, no messaging — everything the extension needs is bundled.
 */
"use strict";

const ICON_ON = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  128: "assets/icons/icon-128.png",
};
const ICON_OFF = {
  16: "assets/icons/icon-16-off.png",
  32: "assets/icons/icon-32-off.png",
  48: "assets/icons/icon-48-off.png",
  128: "assets/icons/icon-128-off.png",
};

function setIcon(enabled) {
  chrome.action.setIcon({ path: enabled ? ICON_ON : ICON_OFF }).catch(() => {});
  chrome.action
    .setTitle({
      title: enabled
        ? "SCATERNET is ON — skabidibi (click to stop)"
        : "SCATERNET is off (click to skat)",
    })
    .catch(() => {});
}

function syncIcon() {
  chrome.storage.local.get({ enabled: false }, (v) => setIcon(!!v.enabled));
}

// On install just reflect current state in the icon. Do NOT write storage here —
// defaults are supplied at every read site, and writing on install can clobber a
// toggle that happens concurrently.
chrome.runtime.onInstalled.addListener(syncIcon);
chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(syncIcon);

// Toolbar click = master toggle.
chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get({ enabled: false }, (v) => {
    const next = !v.enabled;
    chrome.storage.local.set({ enabled: next }, () => setIcon(next));
  });
});

// Keep the icon correct if state changes from the popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "enabled" in changes) setIcon(!!changes.enabled.newValue);
});

// Ensure icon is right whenever the worker spins up.
syncIcon();
