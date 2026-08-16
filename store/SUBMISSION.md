# SCATERNET — Chrome Web Store submission checklist

Everything below is paste-ready. Chrome blocks automation on
`chrome.google.com`, so these dashboard steps are yours to click; I've prepared
every field value.

## 0. Prereqs
- Chrome Web Store **developer account** (one-time **$5** fee) under
  bessudo.tristan@gmail.com — same as CHIENTERNET/RIGOLOL, so likely already paid.
- The package: **`scaternet-v1.0.0.zip`** (repo root, 3.8 MB). Rebuild anytime with
  `./tools/package.sh`.

## 1. Create the item
1. https://chrome.google.com/webstore/devconsole → **Add new item**.
2. Upload `scaternet-v1.0.0.zip`.

## 2. Store listing fields (paste from `store/listing.md`)
- **Name:** `SCATERNET — the internet, on ska`
- **Summary (132 max):** `Flip it on and every page turns into a ska/scat catastrophe: scat gibberish, jazz-ska cartoons, brown stains and terrible skanking music.`
- **Category:** Entertainment
- **Language:** English
- **Description:** the "Detailed description" block in `store/listing.md`.
- **Single purpose:** the "Single purpose" block in `store/listing.md`.
- **Permission justifications:** the two bullets in `store/listing.md`.

## 3. Privacy
- **Privacy policy URL:** `https://tristanvacances.github.io/scaternet/privacy.html`
  — served from `docs/privacy.html` on `master` via GitHub Pages. A dedicated
  HTML page whose entire content is the policy.
  **Verify before pasting** (must print `200` and `text/html`):
  ```sh
  curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
    https://tristanvacances.github.io/scaternet/privacy.html
  ```
  Do **not** substitute the repo root, a `/blob/` URL, or a raw gist URL — the
  first submission was rejected for exactly this (see "Rejection history" below).
- **Data usage:** tick **does NOT collect user data**. It makes no network calls.
- Certify compliance with the Developer Program Policies.

## 4. Graphics
- **Icon:** taken from the zip (128px included).
- **Screenshots (1280×800 or 640×400):** at least one required. Use
  `store/screenshots/hero-scatified.png` (captured by the e2e run). Generate more
  with `node tools/store-shots.mjs` if you want (optional).

## 5. Distribution
- **Visibility:** Public (or Unlisted if you only want to share the link).
- **Trader status:** **Non-trader** (free personal novelty, no payments).

## 6. Submit
- Submit for review. Broad host access (`<all_urls>` content script) → **in-depth
  review**, typically days to ~2 weeks for a first submission. This is inherent to
  the product (must run on every page); no manifest change avoids it.
- Google emails the outcome to bessudo.tristan@gmail.com.

## Rejection history
- **2026-08-13 — v1.0.0 rejected.** Item ID `mmcecpmjjkijhikeambjgndofacmpgph`,
  violation ref **Purple Nickel**, routing ID **FZSL**. Sole violation: *"Privacy
  policy link does not lead to a valid privacy policy."* Nothing else was flagged
  — `<all_urls>` and the crude humour both passed review.
  **Cause:** the privacy policy was never published to a public URL (the gist this
  checklist called for was never created), so the field pointed at something that
  was not a policy page. **Fix:** GitHub Pages URL in §3 above. Resubmit — do not
  appeal; an appeal is for reviewer error, and here the link genuinely was wrong.

## Review-risk notes (honest)
- **Broad host access** — justified in the listing; the extension has NO
  `host_permissions` and makes NO network requests, which is the strongest
  possible framing.
- **Crude humour** — fart sounds + brown "mud" stain overlays. No nudity/sexual
  content (the "bum" image variants were auto-rejected by the generator's own
  NSFW filter and were dropped, so none shipped). If a reviewer objects to crude
  content, it's cosmetic to swap a stain or image out and resubmit.

## Updating later
1. Bump `version` in `manifest.json`. 2. `./tools/package.sh`. 3. Upload the new
   zip to the same item. 4. Resubmit. Local testing needs no review — just reload
   the unpacked extension.
