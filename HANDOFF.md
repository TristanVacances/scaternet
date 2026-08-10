# SCATERNET — HANDOFF

**Status: BUILD COMPLETE & VERIFIED.** 34/34 tests green (ran twice, stable).
Not yet submitted to the Chrome Web Store — that's the one handoff step (money +
outward publish = Tristan's action).

Location: `~/Documents/scaternet/` · local git repo · MV3 Chrome extension.
Third in the joke-extension line after CHIENTERNET (shipped) and RIGOLOL (shipped).

## What it does
Toolbar toggle ON → every page becomes a ska/scat catastrophe: text → scat
gibberish (varied size/font/CAPS + jazz emoji), images → 36 ultra-photorealistic jazz×ska musician
hybrids, continuous layered ska+scat+sax audio (starts on
first click), a scat/fart sound on every click, a ska track layered over every
video (NOT muted — deliberate cacophony), and brown stains scattered on the page.
Popup = ON/OFF + volume + mute-all + layer-over-videos. Toggle off restores in place.

## Verified (ran it, not "should work")
- `npm test` → **34/34 green**, run twice:
  - 16 text-engine unit (scat determinism, whitespace, token layer: size/CAPS/emoji)
  - 6 asset-integrity (36 images + 8 scats + 28 farts + 5 music stems exist & wired;
    load order; storage-only; no host_permissions; icons)
  - 12 Playwright e2e on the REAL unpacked extension (channel:"chromium"): image +
    CSS-bg + poster swap, text→scat spans, title, **brown stains present**, form/
    contenteditable preserved, **video NOT muted** (inverted vs CHIENTERNET),
    MutationObserver on dynamic content, lazy/hijacked-src re-swap, **clean restore**
    (text + images + title + stains gone), **bundled image paints under a real
    img-src 'self' CSP**.
- Visual proof: `store/screenshots/hero-scatified.png` — the joke lands (varied
  scat text in the page's own font, photoreal jazz-ska musicians, solid mud stains).
- `scaternet-v1.0.0.zip` builds (6.3 MB, runtime files only, manifest valid,
  36 images + 41 audio clips).

## Assets (how they were made)
- **Images (36) — ULTRA-PHOTOREALISTIC (Tristan revision):** Higgsfield
  `recraft_v4_1` (standard, 2k), 1:1, single-shot jazz×ska musician photos +
  a few instrument still-lifes. Downscaled to 640px jpg (`sips`). Job IDs/URLs in
  `.genjobs/photoreal-*.tsv`. **All cartoons + poop/bum variants removed.**
  `soul_cast` was tried first but returns character TURNAROUND SHEETS (front/back/
  face, grey studio, no props) — rejected; recraft single-shot is the winner.
  recraft has a **~30% per-job failure rate** — submitted ~46, ~36 succeeded.
- **Scat audio:** Higgsfield `seed_audio` (TTS reading scat onomatopoeia). 2 long
  loops → `assets/audio/music/` (continuous vocal layer), 8 short → `assets/audio/
  scats/` (click one-shots).
- **Ska bed + sax:** CC0 loops via `tools/fetch_ska.py` → `assets/audio/music/`
  (ska-01, sax-01, sax-02). All music/ stems layer at runtime = ska+scat+sax.
  If none play, `scat-audio.js` has a Web-Audio synth-skank fallback.
- **Farts (28, widest spectrum):** 12 CC0 via `tools/fetch_farts.py` + 16
  synthesized via `tools/synth_farts.py` (ffmpeg pitch/vibrato/decay sweep).
- Regenerate everything: `npm run assets`.

## Key decisions / learnings
- **Higgsfield has NO music-generation model** (audio models are TTS only). So the
  ska instrumental bed came from CC0 + a synth fallback; Higgsfield generated the
  scat VOCALS. The runtime layers all `music/` stems for the full sound.
- **Autoplay gate:** page music can only start after a user gesture — it kicks in
  on the first click. Unavoidable; designed around.
- **Video = layer, not mute** (opposite of CHIENTERNET). No `MediaElementSource`,
  so no CORS dependency — a separate bundled `<audio>` plays over the video.
- **Music + clicks are top-frame only** so ad-iframe-heavy pages don't spawn 20
  overlapping loops. Video-layering runs in all frames.
- **Text is element-replacement** (spans with size/CAPS classes + emoji; **fonts
  are NOT swapped** — page keeps its own font, per Tristan), not in-place
  `nodeValue` — with an `isOurs()` guard so the MutationObserver never re-scatifies
  our own scat or the stains.
- **Stains = solid mud** (per Tristan): solid brown blobs + box-shadow splatter
  satellites, per-stain random blob border-radius, multiply blend. NOT the old blur.
- **Image models: z_image rate-limits ~9–10 concurrent; recraft_v4_1 ~30% fail
  rate but far more photoreal.** Submit in waves and reconcile failed counts.
- Default volume 0.5 (several stems layer). Volume slider + mute switch in popup.

## Next (Tristan's step — gated on money + outward publish)
- Submit to Chrome Web Store: follow `store/SUBMISSION.md` (paste-ready fields).
  $5 dev account (likely already paid), publish `store/PRIVACY.md` as a gist for
  the privacy URL, upload `scaternet-v1.0.0.zip`, non-trader, submit. Broad host →
  in-depth review (days–2wk). Chrome blocks automation on chrome.google.com, so
  the dashboard clicks are yours.
- To try it now: `chrome://extensions` → Load unpacked → this folder.

## Known limitations (honest)
- Big/rapidly-mutating pages: scanning every element for CSS backgrounds on each
  mutation isn't free. Fine for a joke.
- Scat vocals are spoken (TTS), not sung — reads as deadpan scat, which is funny.
- 5 music stems + click farts at default 0.5 is loud-chaotic by design; slider tames it.
