#!/usr/bin/env python3
"""Download a big POOL of real-recording SFX candidates for Tristan to audition.

Not for shipping directly — this fills ~/Documents/scaternet/sfx-candidates/<cat>/
with normalized mp3 previews so Tristan can listen and delete the ones he doesn't
want. Whatever survives gets trimmed + wired into the extension afterwards.

Sources: Openverse audio API, licences CC0 + CC-BY (attribution kept per file in
the filename + an index.csv). Real recordings only — Wiktionary/Lingua-Libre
pronunciations are excluded for farts.

Run:  ./.venv/bin/python tools/fetch_sfx_candidates.py   (needs ffmpeg + curl)
"""
import csv
import json
import re
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / "sfx-candidates"
# Openverse sits behind Cloudflare; a bot-ish UA gets a 429 challenge. Use a
# normal browser UA + Accept: application/json.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# category -> (queries, target, min_ms, max_ms, preview_cap_s)
CATS = {
    "farts": (
        ["fart", "wet fart", "fart sound effect", "farting sound", "dry fart",
         "squeaky fart", "long fart", "fart brap", "bottom burp", "flatulence sound"],
        36, 200, 8000, 6,
    ),
    # Tristan wants LONGER trumpet, same feel as the scats: fast scatted notes
    # with pauses. Favour solos/improv/licks and allow long clips.
    "trumpet": (
        ["trumpet solo", "trumpet improvisation", "bebop trumpet", "trumpet lick",
         "trumpet riff", "muted trumpet solo", "jazz trumpet", "trumpet fanfare",
         "trumpet stab", "ska trumpet"],
        30, 1500, 60000, 30,
    ),
    # LONGER scat vocals.
    "scat_vocals": (
        ["scat singing", "jazz scat", "vocal scat", "bebop scat", "doo bop vocal",
         "scat vocal", "vocal jazz improvisation", "scat solo", "scat"],
        26, 1500, 60000, 30,
    ),
    "ska_reggae": (
        ["ska instrumental", "reggae skank guitar", "ska horns", "two tone ska",
         "reggae upstroke", "ska riddim"],
        18, 3000, 60000, 20,
    ),
}


def curl(url, timeout=45, expect_json=True, tries=6):
    """Fetch with retries + backoff. Openverse is behind Cloudflare and rate-limits
    bursts (returns an HTML challenge, not JSON), so retry until we get real JSON."""
    for i in range(tries):
        p = subprocess.run(["curl", "-sS", "-L", "-A", UA, "-H", "Accept: application/json",
                            "--max-time", str(timeout), url], capture_output=True)
        out = p.stdout
        if p.returncode == 0 and out:
            if not expect_json:
                return out
            head = out.lstrip()[:1]
            if head in (b"{", b"["):
                return out
        time.sleep(2.5 + 1.5 * i)  # backoff for Cloudflare relief
    raise RuntimeError("curl blocked/failed after retries")


def is_pronunciation(r):
    t = (r.get("title") or "").lower()
    c = (r.get("creator") or "").lower()
    return t.startswith("ll-q") or "pronunciation" in t or "lingua libre" in t or "lingua libre" in c


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "untitled").lower()).strip("-")[:36] or "untitled"


def main():
    for cat, (queries, target, mn, mx, cap) in CATS.items():
        d = POOL / cat
        d.mkdir(parents=True, exist_ok=True)
        idx = 0
        seen = set()
        rows = []
        for q in queries:
            if idx >= target:
                break
            page = 1
            while idx < target and page <= 4:
                api = (f"https://api.openverse.org/v1/audio/"
                       f"?q={q.replace(' ', '%20')}&license=cc0,by&page_size=30&page={page}")
                try:
                    data = json.loads(curl(api))
                except Exception:
                    break
                results = data.get("results", [])
                if not results:
                    break
                page += 1
                time.sleep(1.2)  # pace API calls so Cloudflare doesn't challenge
                for r in results:
                    if idx >= target:
                        break
                    dur = r.get("duration") or 0
                    url = r.get("url")
                    rid = r.get("id")
                    if not url or rid in seen or not (mn <= dur <= mx):
                        continue
                    if cat == "farts" and is_pronunciation(r):
                        continue
                    seen.add(rid)
                    lic = (r.get("license") or "?").lower()
                    idx += 1
                    name = f"{idx:02d}__{lic}__{slug(r.get('title'))}.mp3"
                    out = d / name
                    try:
                        raw = curl(url, expect_json=False)
                        tmp = d / f".raw-{idx}"
                        tmp.write_bytes(raw)
                        ff = subprocess.run(
                            ["ffmpeg", "-y", "-i", str(tmp), "-t", str(cap),
                             "-af", "loudnorm=I=-15:TP=-1.5:LRA=11",
                             "-ac", "1", "-ar", "44100", "-b:a", "112k", str(out)],
                            capture_output=True,
                        )
                        tmp.unlink(missing_ok=True)
                        if ff.returncode != 0 or not out.exists() or out.stat().st_size < 700:
                            idx -= 1
                            out.unlink(missing_ok=True)
                            continue
                        rows.append({
                            "file": name, "license": lic, "creator": r.get("creator"),
                            "title": r.get("title"), "duration_ms": dur, "query": q,
                            "source_page": r.get("foreign_landing_url"),
                        })
                        print(f"  [{cat}] ✓ {name}  ({dur}ms, q='{q}')")
                    except Exception:
                        idx = max(idx - 1, 0)
                        continue
        # per-category index.csv (provenance for whatever survives curation)
        if rows:
            with open(d / "index.csv", "w", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        print(f"[{cat}] banked {len(rows)} -> {d}\n")


if __name__ == "__main__":
    main()
