#!/usr/bin/env python3
"""Best-effort fetch of CC0 ska / reggae instrumental loops + sax riffs.

These become extra stems in assets/audio/music/, layered UNDER the Higgsfield
scat-vocal loop by the runtime = "ska backing + scats + sax on top". If this
banks little or nothing, the extension's Web-Audio synth-skank fallback keeps a
bed going, so this script is allowed to under-deliver without failing the build.

Outputs: assets/audio/music/ska-NN.mp3, sax-NN.mp3 + SOURCES.md
Run:  ./.venv/bin/python tools/fetch_ska.py   (needs ffmpeg + curl)
"""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "music"
SOURCES = OUT / "SOURCES.md"
UA = "scaternet/1.0 (personal joke extension; CC0 music loops)"

# (prefix, query, target, min_ms, max_ms)
SETS = [
    ("ska", "ska", 3, 3000, 30000),
    ("ska", "reggae skank guitar", 2, 2000, 30000),
    ("sax", "saxophone riff", 2, 1500, 20000),
    ("sax", "saxophone solo", 1, 1500, 20000),
]

# Loops: just cap length + loudness-normalise, keep them long enough to loop.
FFMPEG_FILTER = "atrim=0:20,afade=t=out:st=19.4:d=0.6,loudnorm=I=-16:TP=-1.5:LRA=11"


def curl(url, timeout=45):
    p = subprocess.run(["curl", "-sS", "-L", "-A", UA, "--max-time", str(timeout), url],
                       capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"curl {p.returncode}")
    return p.stdout


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in list(OUT.glob("ska-*.mp3")) + list(OUT.glob("sax-*.mp3")):
        old.unlink()

    files, sources, seen = [], [], set()
    counters = {"ska": 0, "sax": 0}
    for prefix, q, target, mn, mx in SETS:
        got = 0
        page = 1
        while got < target and page <= 4:
            api = (f"https://api.openverse.org/v1/audio/"
                   f"?q={q.replace(' ', '%20')}&license=cc0&page_size=20&page={page}")
            try:
                data = json.loads(curl(api))
            except Exception:
                break
            results = data.get("results", [])
            if not results:
                break
            page += 1
            for r in results:
                if got >= target:
                    break
                dur = r.get("duration") or 0
                url = r.get("url")
                rid = r.get("id")
                if not url or rid in seen or not (mn <= dur <= mx):
                    continue
                seen.add(rid)
                try:
                    raw = curl(url)
                    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                        tf.write(raw)
                        src_path = tf.name
                    counters[prefix] += 1
                    name = f"{prefix}-{counters[prefix]:02d}.mp3"
                    out = OUT / name
                    ff = subprocess.run(
                        ["ffmpeg", "-y", "-i", src_path, "-af", FFMPEG_FILTER,
                         "-ac", "2", "-ar", "44100", "-b:a", "112k", str(out)],
                        capture_output=True,
                    )
                    Path(src_path).unlink(missing_ok=True)
                    if ff.returncode != 0 or not out.exists() or out.stat().st_size < 2000:
                        counters[prefix] -= 1
                        out.unlink(missing_ok=True)
                        continue
                    got += 1
                    files.append(name)
                    sources.append({"file": name, "license": r.get("license"),
                                    "creator": r.get("creator"), "title": r.get("title"),
                                    "source_page": r.get("foreign_landing_url"), "q": q, "ms": dur})
                    print(f"  ✓ {name}  [{r.get('license')}]  {dur}ms  q='{q}'")
                except Exception:
                    continue

    if not files:
        print("No CC0 ska/sax loops banked — runtime synth-skank fallback will cover the bed.")
        return

    hdr = ["# Bundled ska / sax loops — sources & licenses", "",
           "All clips are **CC0**. Layered under the Higgsfield scat-vocal loop at runtime.", ""]
    for s in sources:
        hdr.append(f"- **{s['file']}** — {s['license']} — \"{s['title']}\" "
                   f"by {s['creator'] or 'unknown'} ({s['ms']}ms, q='{s['q']}') — {s['source_page']}")
    SOURCES.write_text("\n".join(hdr) + "\n")
    print(f"\nBanked {len(files)} music stems -> {OUT}")


if __name__ == "__main__":
    main()
