#!/usr/bin/env python3
"""Fetch the WIDEST possible spectrum of CC0 fart / flatulence sounds and trim them.

Tristan wants maximum fart variety. We sweep several Openverse queries (fart,
farting, wet fart, raspberry, flatulence, fart squeak, long fart) filtered to
CC0, keep a broad range of lengths (short blips to long ones) so timbres vary,
and ffmpeg-normalise loudness so they punch consistently on click.

Outputs: assets/audio/farts/fart-NN.mp3 + SOURCES.md
(The JS manifest is regenerated separately by tools/build_manifests.mjs.)
Run:  ./.venv/bin/python tools/fetch_farts.py   (needs ffmpeg + curl)
"""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "farts"
SOURCES = OUT / "SOURCES.md"

TARGET = 40  # aim high — widest spectrum
UA = "scaternet/1.0 (personal joke extension; CC0 fart sounds)"
QUERIES = [
    "fart", "farting", "wet fart", "raspberry sound blow", "flatulence",
    "fart squeak", "long fart", "squelch fart", "poot", "fart bubble",
]
MIN_MS, MAX_MS = 120, 4000  # keep short blips AND longer trumpets for variety

# Gentle: strip only leading/trailing silence, cap at 3.5s, fade tail, normalise.
FFMPEG_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-45dB:detection=peak,"
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
    "atrim=0:3.5,afade=t=out:st=3.3:d=0.2,loudnorm=I=-15:TP=-1.5:LRA=11"
)


def curl(url, timeout=30):
    p = subprocess.run(["curl", "-sS", "-L", "-A", UA, "--max-time", str(timeout), url],
                       capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"curl {p.returncode}: {p.stderr.decode()[:120]}")
    return p.stdout


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("fart-*.mp3"):
        old.unlink()

    files, sources, seen = [], [], set()
    idx = 0
    for q in QUERIES:
        if idx >= TARGET:
            break
        page = 1
        while idx < TARGET and page <= 4:
            api = (f"https://api.openverse.org/v1/audio/"
                   f"?q={q.replace(' ', '%20')}&license=cc0&page_size=20&page={page}")
            try:
                data = json.loads(curl(api))
            except Exception as e:
                print(f"  … query '{q}' page {page} failed ({type(e).__name__})")
                break
            results = data.get("results", [])
            if not results:
                break
            page += 1
            for r in results:
                if idx >= TARGET:
                    break
                dur = r.get("duration") or 0
                url = r.get("url")
                rid = r.get("id")
                if not url or rid in seen or not (MIN_MS <= dur <= MAX_MS):
                    continue
                seen.add(rid)
                try:
                    raw = curl(url)
                    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                        tf.write(raw)
                        src_path = tf.name
                    idx += 1
                    name = f"fart-{idx:02d}.mp3"
                    out = OUT / name
                    ff = subprocess.run(
                        ["ffmpeg", "-y", "-i", src_path, "-af", FFMPEG_FILTER,
                         "-ac", "1", "-ar", "44100", "-b:a", "96k", str(out)],
                        capture_output=True,
                    )
                    Path(src_path).unlink(missing_ok=True)
                    if ff.returncode != 0 or not out.exists() or out.stat().st_size < 700:
                        idx -= 1
                        out.unlink(missing_ok=True)
                        continue
                    files.append(name)
                    sources.append({
                        "file": name, "license": r.get("license"),
                        "creator": r.get("creator"), "title": r.get("title"),
                        "source_page": r.get("foreign_landing_url"), "q": q, "ms": dur,
                    })
                    print(f"  ✓ {name}  [{r.get('license')}]  {dur}ms  q='{q}'  {(r.get('title') or '')[:30]}")
                except Exception as e:
                    print(f"  … skipped one ({type(e).__name__})")
                    continue

    if len(files) < 3:
        raise SystemExit(f"Only banked {len(files)} farts — network/ffmpeg issue? Aborting.")

    lines = ["# Bundled fart sounds — sources & licenses", "",
             "All clips are **CC0** — no attribution legally required; recorded for provenance.",
             f"Total: {len(files)} farts across {len(set(s['q'] for s in sources))} search angles.", ""]
    for s in sources:
        lines.append(f"- **{s['file']}** — {s['license']} — \"{s['title']}\" "
                     f"by {s['creator'] or 'unknown'} ({s['ms']}ms, q='{s['q']}') — {s['source_page']}")
    SOURCES.write_text("\n".join(lines) + "\n")
    print(f"\nBanked {len(files)} farts -> {OUT}\nWrote {SOURCES.name}")


if __name__ == "__main__":
    main()
