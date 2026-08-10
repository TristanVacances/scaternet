# SCATERNET 🎷🥁

**The internet, on ska.** A joke MV3 Chrome extension. Flip it on and every page
becomes an unreadable, unlistenable ska/scat catastrophe. Flip it off and the
page snaps back to normal.

Sibling to [CHIENTERNET] (the internet for dogs) and RIGOLOL. Same proven
architecture, different flavour of chaos.

## What it does (while toggled on)
- **Text → scat gibberish** — "skabidibi doubidou bada boudi booo da bi doo bi do
  baaaba" — in wildly varied sizes, fonts and RANDOM CAPS, sprinkled with jazz
  emoji 🎷🎸🎶.
- **Images → jazz×ska cartoons** — 46 bundled hybrids (pork-pie-hat sax players,
  dreadlocked bassists, dancing instruments, googly-eyed poops).
- **Continuous page audio** — a ska bed + layered scat vocals + honking sax, all
  looping over each other (starts on your first click — browser autoplay rule).
- **Click sounds** — every mouse click fires a scat syllable or one of 28 farts.
- **Video** — a ska track is layered ON TOP of each video's own audio (not muted).
- **Brown stains** scattered across the page.

Popup: master ON/OFF + volume slider + mute-all-sound + layer-over-videos.

## Architecture
Isolated-world content-script pipeline, `storage`-only permission (no network, no
`host_permissions` — everything is bundled), `chrome.storage.onChanged` toggle (no
messaging), attribute `MutationObserver` for lazy/hijacked images.

```
src/state.js          shared settings (chrome.storage wrapper)
src/scatify-text.js   pure text→scat engine (+ token layer: size/font/caps/emoji)
src/images-manifest.js  generated list of bundled images
src/swap-images.js    <img>/<picture>/<video poster>/CSS-bg swapper (bundled only)
src/audio-manifest.js   generated lists of bundled audio
src/scat-audio.js     music-loop layering, click scats, farts, layer-over-video, synth fallback
src/content.js        orchestrator: scatify text→spans, stains, drive audio, restore
src/background.js     toolbar toggle + icon
src/popup.{html,js}   ON/OFF + volume + mute + video toggle
```

## Build & test
```bash
npm install
npm test                 # 34 tests: text engine + asset integrity + Playwright e2e
npm run assets           # regenerate icons + fart pack + ska loops + manifests
./tools/package.sh       # -> scaternet-v1.0.0.zip (runtime files only)
```
Asset generation: images via Higgsfield (see `.genjobs/`), scat vocals via
Higgsfield seed_audio, farts via CC0 (`tools/fetch_farts.py`) + synthesis
(`tools/synth_farts.py`), ska/sax loops via CC0 (`tools/fetch_ska.py`).

## Load it locally
`chrome://extensions` → Developer mode → **Load unpacked** → this folder. Click the
🎵 toolbar icon, then browse. Click a page to start the music.

See `store/SUBMISSION.md` to publish to the Chrome Web Store.

[CHIENTERNET]: https://github.com/ (sibling project)
